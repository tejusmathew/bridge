import cv2
import numpy as np
from scipy.interpolate import interp1d


# ── Frame Preprocessing ────────────────────────────────────────

# Target resolution for MediaPipe (matches common training setup)
PROCESS_WIDTH = 640
PROCESS_HEIGHT = 480


def normalize_brightness(frame):
    """Auto brightness/contrast using CLAHE (Contrast Limited Adaptive
    Histogram Equalization). Helps MediaPipe detect landmarks in poor
    lighting — overexposed or underexposed videos.
    """
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def resize_frame(frame, width=PROCESS_WIDTH, height=PROCESS_HEIGHT):
    """Resize frame to standard resolution while preserving aspect ratio.
    Pads with black to fill target dimensions.
    """
    h, w = frame.shape[:2]
    scale = min(width / w, height / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # Pad to target size (center the frame)
    canvas = np.zeros((height, width, 3), dtype=np.uint8)
    x_offset = (width - new_w) // 2
    y_offset = (height - new_h) // 2
    canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized
    return canvas


def denoise_frame(frame):
    """Lightweight Gaussian blur to reduce video noise.
    Uses small kernel to preserve hand/finger detail.
    """
    return cv2.GaussianBlur(frame, (3, 3), 0)


def detect_signer_roi(frame, mp_holistic):
    """Detect signer's bounding box from pose landmarks.
    Returns (x, y, w, h) crop region or None if no person detected.
    Used on first frame to establish ROI for all subsequent frames.
    """
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = mp_holistic.process(image)

    if not results.pose_landmarks:
        return None

    landmarks = results.pose_landmarks.landmark
    h, w = frame.shape[:2]

    # Get bounding box from all visible pose landmarks
    xs = [lm.x * w for lm in landmarks if lm.visibility > 0.3]
    ys = [lm.y * h for lm in landmarks if lm.visibility > 0.3]

    if not xs or not ys:
        return None

    # Add 20% padding around the signer
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    pad_x = (x_max - x_min) * 0.2
    pad_y = (y_max - y_min) * 0.2

    x1 = max(0, int(x_min - pad_x))
    y1 = max(0, int(y_min - pad_y))
    x2 = min(w, int(x_max + pad_x))
    y2 = min(h, int(y_max + pad_y))

    return (x1, y1, x2 - x1, y2 - y1)


def crop_to_roi(frame, roi):
    """Crop frame to signer ROI."""
    x, y, w, h = roi
    return frame[y:y + h, x:x + w]


def preprocess_frame(frame, roi=None):
    """Full preprocessing pipeline for a single frame.

    Steps:
      1. Crop to signer ROI (if available)
      2. Resize to standard resolution (640×480)
      3. Normalize brightness (CLAHE)
      4. Denoise (light Gaussian blur)

    Returns preprocessed BGR frame ready for MediaPipe.
    """
    if roi is not None:
        frame = crop_to_roi(frame, roi)
    frame = resize_frame(frame)
    frame = normalize_brightness(frame)
    frame = denoise_frame(frame)
    return frame


def extract_keypoints(results):
    """Extract and normalize keypoints to match the training data format.

    Normalization: coords are centered on hip midpoint and scaled by shoulder width.
    This matches normalize_landmarks() in training/extract_key_points.py exactly.
    Output: 258-dim vector (33*4 pose + 21*3 left_hand + 21*3 right_hand)
    """
    if not results.pose_landmarks:
        return np.zeros(258)

    landmarks = results.pose_landmarks.landmark

    # Reference points for normalization
    left_hip = np.array([landmarks[23].x, landmarks[23].y])
    right_hip = np.array([landmarks[24].x, landmarks[24].y])
    hip_center = (left_hip + right_hip) / 2

    left_shoulder = np.array([landmarks[11].x, landmarks[11].y])
    right_shoulder = np.array([landmarks[12].x, landmarks[12].y])
    shoulder_width = np.linalg.norm(left_shoulder - right_shoulder)

    # Fallback scale
    if shoulder_width < 1e-6:
        hip_width = np.linalg.norm(left_hip - right_hip)
        scale = hip_width if hip_width > 1e-6 else 1.0
    else:
        scale = shoulder_width

    def norm_point(x, y, z):
        return [(x - hip_center[0]) / scale,
                (y - hip_center[1]) / scale,
                z / scale]

    # 1. Pose: 33 landmarks × 4 (normalized x, y, z + visibility)
    pose = np.array([
        norm_point(lm.x, lm.y, lm.z) + [lm.visibility]
        for lm in landmarks
    ]).flatten()

    # 2. Left hand: normalized
    if results.left_hand_landmarks:
        pts = np.array([[lm.x, lm.y, lm.z] for lm in results.left_hand_landmarks.landmark])
        pts[:, 0] = (pts[:, 0] - hip_center[0]) / scale
        pts[:, 1] = (pts[:, 1] - hip_center[1]) / scale
        pts[:, 2] = pts[:, 2] / scale
        lh = pts.flatten()
    else:
        lh = np.zeros(63)

    # 3. Right hand: normalized
    if results.right_hand_landmarks:
        pts = np.array([[lm.x, lm.y, lm.z] for lm in results.right_hand_landmarks.landmark])
        pts[:, 0] = (pts[:, 0] - hip_center[0]) / scale
        pts[:, 1] = (pts[:, 1] - hip_center[1]) / scale
        pts[:, 2] = pts[:, 2] / scale
        rh = pts.flatten()
    else:
        rh = np.zeros(63)

    return np.concatenate([pose, lh, rh])  # 132 + 63 + 63 = 258


def temporal_interpolate(data, target_len=30):
    """Resample sequence to fixed length using per-dimension linear interpolation.

    This matches temporal_interpolate() in training/extract_key_points.py exactly.
    Uses scipy.interpolate.interp1d — NOT scipy.ndimage.zoom.
    """
    data = np.array(data)

    if data.size == 0 or len(data) == 0:
        return np.zeros((target_len, 258), dtype=np.float32)

    if data.ndim == 1:
        data = data.reshape(1, -1)

    current_len = data.shape[0]

    if current_len == target_len:
        return data.astype(np.float32)

    if current_len == 0:
        return np.zeros((target_len, data.shape[1]), dtype=np.float32)

    if current_len == 1:
        return np.tile(data, (target_len, 1)).astype(np.float32)

    # Per-dimension linear interpolation (matches training exactly)
    x_old = np.linspace(0, 1, current_len)
    x_new = np.linspace(0, 1, target_len)

    interpolated = np.zeros((target_len, data.shape[1]), dtype=np.float32)

    for dim in range(data.shape[1]):
        interpolator = interp1d(
            x_old, data[:, dim],
            kind='linear',
            bounds_error=False,
            fill_value='extrapolate'
        )
        interpolated[:, dim] = interpolator(x_new)

    return interpolated
