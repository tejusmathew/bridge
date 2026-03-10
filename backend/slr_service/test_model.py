"""
Direct model test: Feed training .npy files to models to verify they work.
This bypasses ALL extraction logic — if predictions are still wrong, the
problem is model loading. If correct, the problem is keypoint extraction.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import json
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F

from config import CHECKPOINT_DIR, LABEL_MAPPING_PATH, DEVICE, INPUT_DIM, HIDDEN_DIM, DROPOUT, NUM_CLASSES
from model import ISLModel


def test_with_training_data():
    # Load label mapping
    with open(LABEL_MAPPING_PATH) as f:
        mapping = json.load(f)
    idx_to_label = {int(k): v for k, v in mapping["idx2label"].items()}
    label_to_idx = {v: int(k) for k, v in mapping["idx2label"].items()}
    print(f"Labels: {len(idx_to_label)}\n")

    # Load ONE model (fold 1)
    model = ISLModel(INPUT_DIM, HIDDEN_DIM, NUM_CLASSES, DROPOUT).to(DEVICE)
    ckpt = torch.load(CHECKPOINT_DIR / "fold_1_best.pth", map_location=DEVICE, weights_only=False)
    model.load_state_dict(ckpt["model"])
    model.eval()
    print(f"✓ Model loaded (fold 1, acc: {ckpt.get('accuracy', 'N/A')})\n")

    # Find training CSV
    csv_candidates = [
        Path(r"d:\final_sign_to_txt\keypoints_data\dataset_metadata.csv"),
        Path(r"D:\bridge_dataset\taking_infernce\training\keypoints_data\dataset_metadata.csv"),
        Path(r"D:\bridge_dataset\training\keypoints_data\dataset_metadata.csv"),
    ]
    
    csv_path = None
    for c in csv_candidates:
        if c.exists():
            csv_path = c
            break
    
    if csv_path is None:
        print("❌ Cannot find dataset_metadata.csv")
        return
    
    df = pd.read_csv(csv_path)
    print(f"Dataset: {csv_path}")
    print(f"Samples: {len(df)}, Labels: {df['label'].nunique()}\n")

    # Test with specific labels
    test_labels = ["Actor", "Acceleration", "Theory", "Doctor", "Love", "Machine"]
    
    for test_label in test_labels:
        matches = df[df['label'] == test_label]
        if len(matches) == 0:
            print(f"  '{test_label}': not found in dataset")
            continue
        
        row = matches.iloc[0]
        npy_path = Path(row['path'])
        
        if not npy_path.exists():
            print(f"  '{test_label}': .npy not found at {npy_path}")
            continue
        
        # Load EXACTLY as training does
        data = np.load(npy_path).astype(np.float32)
        tensor = torch.FloatTensor(data).unsqueeze(0).to(DEVICE)  # [1, 30, 258]
        
        with torch.no_grad():
            logits = model(tensor)
            probs = F.softmax(logits, dim=1)
        
        conf, pred_idx = probs.max(1)
        predicted = idx_to_label[int(pred_idx.item())]
        
        top3_vals, top3_idxs = probs[0].topk(3)
        top3_str = ", ".join(f"{idx_to_label[int(i.item())]}({v:.3f})" for v, i in zip(top3_vals, top3_idxs))
        
        correct = "✅" if predicted == test_label else "❌"
        print(f"  {correct} '{test_label}' → predicted '{predicted}' ({conf.item():.4f})  |  Top3: {top3_str}")
        print(f"     .npy shape: {data.shape}, range: [{data.min():.3f}, {data.max():.3f}]")


if __name__ == "__main__":
    test_with_training_data()
