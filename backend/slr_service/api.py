"""
Sign Language Video → Text Transcript API

POST /generate-transcript  (multipart/form-data, field: "file")

Returns JSON with predicted transcript from ISL sign language video.
Each sign is assumed to be exactly 9 seconds long.
"""
import os
import sys
import time
import logging
import tempfile
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Ensure inference modules are importable
sys.path.insert(0, str(Path(__file__).parent))

from infer import load_models, load_labels, extract_and_segment, classify_segment
from config import MODEL_WINDOW_SIZE, PORT

# ── Logging ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("api.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────

SIGN_DURATION_SECONDS = 9
TARGET_FPS = 15
FRAMES_PER_SIGN = SIGN_DURATION_SECONDS * TARGET_FPS  # 135
ALLOWED_EXTENSIONS = {".mp4", ".webm", ".avi"}
MAX_FILE_SIZE_MB = 100

# ── Global model state (loaded once at startup) ────────────────

models = None
idx_to_label = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models once at startup."""
    global models, idx_to_label
    logger.info("Loading models...")
    models = load_models()
    idx_to_label = load_labels()
    logger.info("API ready")
    yield
    logger.info("Shutting down")


# ── FastAPI App ─────────────────────────────────────────────────

app = FastAPI(
    title="Sign Language Recognition API",
    description="Converts ISL sign language video to text transcript",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── POST /generate-transcript ──────────────────────────────────

@app.post("/generate-transcript")
async def generate_transcript(file: UploadFile = File(...)):
    """
    Accept a sign language video, segment into 9-second chunks,
    predict each sign, and return a text transcript.
    """
    start_time = time.time()

    # ── Validate file ──
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # ── Save upload to temp file ──
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            
            # Size check
            size_mb = len(content) / (1024 * 1024)
            if size_mb > MAX_FILE_SIZE_MB:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large ({size_mb:.1f}MB). Max: {MAX_FILE_SIZE_MB}MB",
                )
            
            tmp.write(content)
            tmp_path = tmp.name

        logger.info(f"Received: {file.filename} ({size_mb:.1f}MB)")

        # ── Extract keypoints and segment (no preprocessing = matches training) ──
        segments, duration = extract_and_segment(tmp_path, enhance=False)

        if not segments:
            raise HTTPException(status_code=422, detail="No sign segments detected in video")

        logger.info(f"Video: {duration:.1f}s → {len(segments)} segments")

        # ── Predict each segment ──
        predictions = []
        for i, seg in enumerate(segments):
            result = classify_segment(models, seg, idx_to_label)
            if result is None:
                predictions.append({"word": "???", "confidence": 0.0})
                continue

            label, confidence, top5 = result
            predictions.append({"word": label, "confidence": round(confidence, 4)})
            logger.info(f"  Segment {i+1}: {label} ({confidence:.4f})")

        # ── Build transcript ──
        transcript = " ".join(p["word"] for p in predictions)
        
        processing_time = time.time() - start_time

        logger.info(f"Transcript: {transcript} ({processing_time:.1f}s)")

        return JSONResponse(
            content={
                "status": "success",
                "transcript": transcript,
                "segments": len(predictions),
                "processing_time": f"{processing_time:.1f}s",
                "predictions": predictions,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        # Clean up temp file
        if "tmp_path" in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Health check ────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": models is not None,
        "num_models": len(models) if models else 0,
        "num_labels": len(idx_to_label) if idx_to_label else 0,
    }


# ── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=PORT, reload=False)

