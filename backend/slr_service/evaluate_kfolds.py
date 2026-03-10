import sys
from pathlib import Path
import json
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import precision_score, recall_score, f1_score

from config import CHECKPOINT_DIR, LABEL_MAPPING_PATH, DEVICE, INPUT_DIM, HIDDEN_DIM, DROPOUT, NUM_CLASSES, ROOT_DIR
from model import ISLModel

class ISLDataset(Dataset):
    def __init__(self, df, label_to_idx, data_dir):
        self.df = df
        self.label_to_idx = label_to_idx
        self.data_dir = Path(data_dir)
        
        # Filter out missing files to avoid errors
        self.valid_samples = []
        for idx, row in df.iterrows():
            basenm = Path(row['path']).name
            actual_path = self.data_dir / basenm
            if actual_path.exists():
                if row['label'] in self.label_to_idx:
                    self.valid_samples.append((actual_path, self.label_to_idx[row['label']]))
                else:
                    pass # label not in mapping
                
    def __len__(self):
        return len(self.valid_samples)
        
    def __getitem__(self, idx):
        path, label_idx = self.valid_samples[idx]
        data = np.load(path).astype(np.float32)
        # Ensure it's 30 frames
        if data.shape[0] != 30:
            pass # Shouldn't happen based on metadata, but normally interpolates
        return torch.FloatTensor(data), torch.tensor(label_idx, dtype=torch.long)

def evaluate_models():
    print(f"Loading labels from {LABEL_MAPPING_PATH}...")
    with open(LABEL_MAPPING_PATH) as f:
        mapping = json.load(f)
    idx_to_label = {int(k): v for k, v in mapping["idx2label"].items()}
    label_to_idx = {v: int(k) for k, v in mapping["idx2label"].items()}
    
    # Load metadata
    csv_path = ROOT_DIR / "keypoints_data" / "dataset_metadata.csv"
    data_dir = ROOT_DIR / "keypoints_data"
    
    print(f"Loading dataset from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    dataset = ISLDataset(df, label_to_idx, data_dir)
    print(f"Found {len(dataset)} valid samples out of {len(df)}.")
    
    dataloader = DataLoader(dataset, batch_size=256, shuffle=False, num_workers=4)
    
    # Load all models
    models = []
    print("Loading models...")
    for fold in range(1, 6):
        model = ISLModel(INPUT_DIM, HIDDEN_DIM, NUM_CLASSES, DROPOUT).to(DEVICE)
        ckpt_path = CHECKPOINT_DIR / f"fold_{fold}_best.pth"
        if not ckpt_path.exists():
            ckpt_path = CHECKPOINT_DIR / f"fold_{fold}_best.pt"
            
        if not ckpt_path.exists():
            print(f"Missing fold {fold} checkpoint!")
            continue
            
        ckpt = torch.load(ckpt_path, map_location=DEVICE, weights_only=False)
        if isinstance(ckpt, dict) and "model" in ckpt:
            model.load_state_dict(ckpt["model"])
        else:
            model.load_state_dict(ckpt)
        model.eval()
        models.append(model)
        print(f"Loaded fold {fold}")

    if not models:
        print("No models found!")
        return

    print("Evaluating...")
    all_targets = []
    all_preds_ensemble = []
    fold_preds = {i: [] for i in range(len(models))}
    
    with torch.no_grad():
        for batch_x, batch_y in dataloader:
            batch_x = batch_x.to(DEVICE)
            all_targets.extend(batch_y.numpy())
            
            # Get predictions from all models
            batch_probs = []
            for i, model in enumerate(models):
                logits = model(batch_x)
                probs = F.softmax(logits, dim=1)
                batch_probs.append(probs)
                
                # Store fold predictions
                pred_idx = probs.argmax(dim=1).cpu().numpy()
                fold_preds[i].extend(pred_idx)
                
            # Ensemble predictions
            avg_probs = torch.stack(batch_probs, dim=0).mean(dim=0)
            ensemble_pred = avg_probs.argmax(dim=1).cpu().numpy()
            all_preds_ensemble.extend(ensemble_pred)

    all_targets = np.array(all_targets)
    all_preds_ensemble = np.array(all_preds_ensemble)
    
    # Calculate metrics
    print("\n--- RESULTS ---")
    
    # Per fold metrics
    for i in range(len(models)):
        fold_p = precision_score(all_targets, fold_preds[i], average='macro', zero_division=0)
        fold_r = recall_score(all_targets, fold_preds[i], average='macro', zero_division=0)
        fold_f1 = f1_score(all_targets, fold_preds[i], average='macro', zero_division=0)
        print(f"Fold {i+1}: Precision={fold_p:.4f}, Recall={fold_r:.4f}, F1={fold_f1:.4f}")
        
    print("\n[Ensemble (Average Over K Folds)]")
    ens_p = precision_score(all_targets, all_preds_ensemble, average='macro', zero_division=0)
    ens_r = recall_score(all_targets, all_preds_ensemble, average='macro', zero_division=0)
    ens_f1 = f1_score(all_targets, all_preds_ensemble, average='macro', zero_division=0)
    print(f"• Precision: {ens_p:.4f}")
    print(f"• Recall: {ens_r:.4f}")
    print(f"• F1-Score: {ens_f1:.4f}")
    print("• Mean Temporal IoU: N/A (Classification model on pre-trimmed clips)")
    
if __name__ == "__main__":
    evaluate_models()
