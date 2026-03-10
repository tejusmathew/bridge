import os
import uuid
import logging

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gtts import gTTS
import uvicorn

from text_processor import normalize_text
from config import AUTH_TOKEN, PORT, BASE_URL

# ── Logging ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ── FastAPI App ─────────────────────────────────────────────────

app = FastAPI(title="Text-to-Speech API", description="Bridge Platform Output Layer TTS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure audio directory exists
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Mount static directory for serving audio files
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

# ── Health Check ────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "tts"
    }

# ── Request Schema ──────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    voice: str = "default"
    speed: float = 1.0

# ── TTS Generators ──────────────────────────────────────────────

def generate_online_audio(text: str, filename: str, language: str) -> bool:
    try:
        tts = gTTS(text=text, lang=language, slow=False)
        tts.save(filename)
        return os.path.exists(filename)
    except Exception as e:
        logger.error(f"Online gTTS failed: {e}")
        return False

def generate_offline_audio(text: str, filename: str, speed: float) -> bool:
    import pyttsx3
    import multiprocessing
    
    def _run_pyttsx3(t, f, s):
        try:
            engine = pyttsx3.init()
            engine.setProperty('rate', int(150 * s))
            engine.save_to_file(t, f)
            engine.runAndWait()
        except Exception:
            pass

    try:
        p = multiprocessing.Process(target=_run_pyttsx3, args=(text, filename, speed))
        p.start()
        p.join(timeout=10)
        if p.is_alive():
            p.terminate()
            p.join()
            return False
        return os.path.exists(filename)
    except Exception as e:
        logger.error(f"Offline TTS failed: {e}")
        return False

# ── POST /generate-speech ──────────────────────────────────────

@app.post("/generate-speech")
def generate_speech(request: TTSRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized request")
    token = authorization.split(" ")[1]
    if token != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")

    normalized_text = normalize_text(request.text)
    
    if not normalized_text:
        raise HTTPException(status_code=400, detail="Invalid text input")

    audio_id = str(uuid.uuid4())
    audio_filename = f"tts_{audio_id}.mp3"
    audio_path = os.path.join(AUDIO_DIR, audio_filename)

    logger.info(f"Generating speech for: '{normalized_text[:50]}...'")

    # Strategy 1: Online (gTTS) - High quality, thread safe
    success = generate_online_audio(normalized_text, audio_path, request.language)
    
    # Strategy 2: Offline Fallback (pyttsx3) - Subprocess wrapped to prevent hangs
    if not success:
        success = generate_offline_audio(normalized_text, audio_path, request.speed)
        
    if not success:
        raise HTTPException(status_code=500, detail="Speech synthesis failure")
    
    audio_url = f"{BASE_URL}/audio/{audio_filename}"

    logger.info(f"Speech generated: {audio_url}")

    return JSONResponse(content={
        "status": "success",
        "audio_url": audio_url,
        "format": "mp3",
        "duration": "unknown" 
    })

# ── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("tts_main:app", host="0.0.0.0", port=PORT, reload=False)
