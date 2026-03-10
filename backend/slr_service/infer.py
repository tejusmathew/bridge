"""
Simplified ISL Video-to-Text Inference

Pipeline: video → MediaPipe keypoints → 5 BiLSTM models → average softmax → predicted word(s)

Segmentation rules:
  - Video ≤ 9 seconds → single word (no segmentation)
  - Video > 9 seconds → smart segmentation:
      • Start a segment when hands are detected
      • End a segment after 135 frames (9s at 15fps) OR when hands stop
      • Wait for hands to start again for next segment
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from mediapipe.python.solutions import holistic as mp_holistic_module

from config import (
    CHECKPOINT_DIR, LABEL_MAPPING_PATH, DEVICE,
    INPUT_DIM, HIDDEN_DIM, DROPOUT, NUM_CLASSES,
    MODEL_WINDOW_SIZE, NO_HAND_PATIENCE
)
from model import ISLModel
from utils import extract_keypoints, temporal_interpolate, preprocess_frame, detect_signer_roi


# ── Constants ───────────────────────────────────────────────────

TARGET_FPS = 15
SIGN_DURATION_SEC = 9
MAX_SEGMENT_FRAMES = SIGN_DURATION_SEC * TARGET_FPS  # 135 frames


# ── 1. Load models ──────────────────────────────────────────────

def load_models():
    """Load all 5 fold-trained models and set to eval mode."""
    models = []
    for fold in range(1, 6):
        model = ISLModel(INPUT_DIM, HIDDEN_DIM, NUM_CLASSES, DROPOUT).to(DEVICE)

        ckpt_path = CHECKPOINT_DIR / f"fold_{fold}_best.pth"
        if not ckpt_path.exists():
            ckpt_path = CHECKPOINT_DIR / f"fold_{fold}_best.pt"

        if not ckpt_path.exists():
            print(f"  ⚠️  Checkpoint not found: {ckpt_path}")
            continue

        checkpoint = torch.load(ckpt_path, map_location=DEVICE, weights_only=False)

        if isinstance(checkpoint, dict) and "model" in checkpoint:
            model.load_state_dict(checkpoint["model"])
            acc = checkpoint.get("accuracy", "N/A")
            print(f"  ✓ Loaded {ckpt_path.name}  (acc: {acc})")
        else:
            model.load_state_dict(checkpoint)
            print(f"  ✓ Loaded {ckpt_path.name}")

        model.eval()
        models.append(model)

    print(f"✅ {len(models)} models loaded\n")
    return models


# ── 2. Load labels ──────────────────────────────────────────────

def load_labels():
    """Load idx→label mapping from label_mapping.json."""
    with open(LABEL_MAPPING_PATH, "r") as f:
        mapping = json.load(f)
    idx_to_label = {int(k): v for k, v in mapping["idx2label"].items()}
    print(f"✅ Loaded {len(idx_to_label)} labels\n")
    return idx_to_label


# ── 3. Classify a single segment ───────────────────────────────

def classify_segment(models, keypoints_list, idx_to_label):
    """Resample segment to MODEL_WINDOW_SIZE (30) frames, run 5 models, average.

    Returns:
        (label, confidence, top5)  or  None if segment is too short
    """
    if len(keypoints_list) < 5:
        return None

    data = temporal_interpolate(keypoints_list, MODEL_WINDOW_SIZE)
    tensor = torch.FloatTensor(data).unsqueeze(0).to(DEVICE)  # [1, 30, 258]

    all_probs = []
    with torch.no_grad():
        for model in models:
            logits = model(tensor)
            probs = F.softmax(logits, dim=1)
            all_probs.append(probs)

    avg_probs = torch.stack(all_probs, dim=0).mean(dim=0)  # [1, 926]

    conf, pred_idx = avg_probs.max(dim=1)
    label = idx_to_label[int(pred_idx.item())]
    confidence = conf.item()

    top5_vals, top5_idxs = avg_probs[0].topk(5)
    top5 = [
        (idx_to_label[int(idx.item())], val.item())
        for val, idx in zip(top5_vals, top5_idxs)
    ]

    return label, confidence, top5


# ── 4. Extract and segment video ───────────────────────────────

def extract_and_segment(video_path, enhance=False):
    """Read video, extract keypoints at 15fps, and segment.

    Args:
        video_path: path to video file
        enhance: if True, apply preprocessing (ROI crop, resize, CLAHE, denoise).
                 Default False = raw frames, matches training exactly.

    Segmentation:
      - ≤ 165 frames (≤ 11s at 15fps) → single word (first 135 frames)
      - > 165 frames → fixed 135-frame chunks

    Returns:
        list of segments (each segment is a list of 258-dim keypoint arrays),
        video duration in seconds
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30
    duration = total_frames / max(fps, 1)

    print(f"🎥 Video: {Path(video_path).name}")
    print(f"   Frames: {total_frames}  |  FPS: {fps:.1f}  |  Duration: {duration:.1f}s")
    print(f"   Preprocessing: {'ON' if enhance else 'OFF (raw frames, matches training)'}")

    frame_skip = max(1, round(fps / TARGET_FPS))
    print(f"   Frame skip: every {frame_skip} frames (target {TARGET_FPS} fps)")

    mp_holistic = mp_holistic_module.Holistic(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    # Detect signer ROI (only if enhance mode)
    roi = None
    if enhance:
        ret, first_frame = cap.read()
        if not ret:
            cap.release()
            return [], duration

        roi = detect_signer_roi(first_frame, mp_holistic)
        if roi:
            print(f"   ✓ Signer ROI detected: x={roi[0]}, y={roi[1]}, w={roi[2]}, h={roi[3]}")
        else:
            print(f"   ⚠ No signer ROI detected, using full frame")

        # Reset video and re-init MediaPipe
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        mp_holistic.close()
        mp_holistic = mp_holistic_module.Holistic(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    # Extract all keypoints
    all_keypoints = []
    hand_flags = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_skip != 0:
            frame_idx += 1
            continue

        frame_idx += 1

        if enhance:
            processed = preprocess_frame(frame, roi=roi)
            image = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
        else:
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = mp_holistic.process(image)

        kp = extract_keypoints(results)
        all_keypoints.append(kp)

        left_lm = getattr(results, "left_hand_landmarks", None)
        right_lm = getattr(results, "right_hand_landmarks", None)
        hand_flags.append(left_lm is not None or right_lm is not None)

    cap.release()
    mp_holistic.close()

    hands_count = sum(hand_flags)
    print(f"   ✓ {len(all_keypoints)} frames extracted ({hands_count} with hands)")

    if not all_keypoints:
        return [], duration

    # ── Segmentation ──
    # Buffer: 2 seconds (30 frames at 15fps) — handles slightly over 9s videos
    BUFFER_FRAMES = 2 * TARGET_FPS  # 30 frames = 2 seconds
    SINGLE_WORD_LIMIT = MAX_SEGMENT_FRAMES + BUFFER_FRAMES  # 165 frames = 11 seconds

    # Rule: ≤ 11 seconds → single word (use only first 135 frames)
    if len(all_keypoints) <= SINGLE_WORD_LIMIT:
        trimmed = all_keypoints[:MAX_SEGMENT_FRAMES]  # Take only first 9 seconds
        print(f"   → Single word mode ({len(all_keypoints)} frames ≤ {SINGLE_WORD_LIMIT}, using first {len(trimmed)})\n")
        return [trimmed], duration

    # Rule: > 11 seconds → fixed 135-frame chunks
    segments = [
        all_keypoints[i:i + MAX_SEGMENT_FRAMES]
        for i in range(0, len(all_keypoints), MAX_SEGMENT_FRAMES)
    ]

    # Drop last chunk if not a full 9-second segment (leftover buffer frames)
    if len(segments) > 1 and len(segments[-1]) < MAX_SEGMENT_FRAMES:
        segments = segments[:-1]

    print(f"   → {len(segments)} segments of {MAX_SEGMENT_FRAMES} frames each\n")
    return segments, duration


# ── 5. Main inference (single entry point) ─────────────────────

def infer_video(video_path, enhance=False):
    """Unified inference: auto-detects single word vs phrase.
    
    Args:
        enhance: if True, apply frame preprocessing (ROI crop, CLAHE, etc.)
    """
    video_path = Path(video_path)
    if not video_path.exists():
        print(f"❌ File not found: {video_path}")
        sys.exit(1)

    _print_header()
    models = load_models()
    idx_to_label = load_labels()

    segments, duration = extract_and_segment(video_path, enhance=enhance)

    if not segments:
        print("❌ No sign segments detected")
        return []

    # Single segment → single word output
    if len(segments) == 1:
        result = classify_segment(models, segments[0], idx_to_label)
        if result is None:
            print("❌ Too few frames")
            return []

        label, confidence, top5 = result
        _print_result(label, confidence, top5)
        return [{"word": label, "confidence": confidence}]

    # Multiple segments → phrase output
    results = []
    for i, seg in enumerate(segments, 1):
        result = classify_segment(models, seg, idx_to_label)
        if result is None:
            print(f"   Segment {i}: ({len(seg)} frames) — too short, skipped")
            continue

        label, confidence, top5 = result
        print(f"   Segment {i}: ({len(seg):>3d} frames) → {label:<20s} ({confidence:.4f})")
        results.append({"word": label, "confidence": confidence})

    if results:
        phrase = " ".join(r["word"] for r in results)
        print("\n" + "=" * 50)
        print(f"  Predicted Phrase: {phrase}")
        print("=" * 50 + "\n")

    return results


# ── Helpers ─────────────────────────────────────────────────────

def _print_header():
    print("=" * 50)
    print("  ISL Video-to-Text  (simplified)")
    print("=" * 50 + "\n")


def _print_result(label, confidence, top5):
    print("=" * 50)
    print(f"  Predicted: {label}  (confidence: {confidence:.4f})")
    print("=" * 50)
    print("\n  Top-5 predictions:")
    for i, (lbl, conf) in enumerate(top5, 1):
        bar = "█" * int(conf * 40)
        print(f"    {i}. {lbl:<20s} {conf:.4f}  {bar}")
    print()
