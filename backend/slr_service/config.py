import os
from pathlib import Path

import torch
from dotenv import load_dotenv

load_dotenv()

# Root directory (sign_recognition folder itself)
ROOT_DIR = Path(__file__).parent

# Device
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Paths — checkpoints live in the self-contained models directory
CHECKPOINT_DIR = Path(os.getenv(
    "CHECKPOINT_DIR",
    str(ROOT_DIR / "models")
))
LABEL_MAPPING_PATH = CHECKPOINT_DIR / "label_mapping.json"

# Model architecture
INPUT_DIM = 258       # 33*4 pose + 21*3 left hand + 21*3 right hand
HIDDEN_DIM = 128
DROPOUT = 0.5
NUM_CLASSES = 926

# Video processing
FPS = 30
DURATION_SECONDS = 9
WINDOW_SIZE = FPS * DURATION_SECONDS  # 270 frames (max extraction)

# Model input — models were trained on 30-frame sequences
MODEL_WINDOW_SIZE = 30

# Segmentation — gap (in frames at ~15fps) of no hands to end a segment
# 20 frames at 15fps ≈ 1.3 seconds — avoids splitting within a single sign
NO_HAND_PATIENCE = 20

# Server
PORT = int(os.getenv("PORT", "8006"))
