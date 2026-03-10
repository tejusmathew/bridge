import os
import uuid
import json
import wave
import logging
import requests
import zipfile

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from vosk import Model, KaldiRecognizer
import uvicorn

from audio_processor import convert_to_wav
from config import AUTH_TOKEN, PORT

# ── Logging ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ── FastAPI App ─────────────────────────────────────────────────

app = FastAPI(title="Speech-to-Text API", description="Bridge Platform Input Layer STT")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Vosk Model at Startup (With Auto-Download) ─────────────

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model")
MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"

if not os.path.exists(MODEL_PATH):
    logger.info("Vosk model not found in 'model' directory. Attempting download...")
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    zip_path = os.path.join(os.path.dirname(__file__), "vosk-model.zip")
    
    if not os.path.exists(zip_path):
        logger.info(f"Downloading Vosk Model to {zip_path}...")
        try:
            r = requests.get(MODEL_URL, stream=True)
            with open(zip_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info("Extracting model...")
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(os.path.dirname(MODEL_PATH))
                
            os.remove(zip_path)
            
            # The zip extracts as 'vosk-model-small-en-us-0.15' so we rename it
            extracted_folder = os.path.join(os.path.dirname(MODEL_PATH), "vosk-model-small-en-us-0.15")
            if os.path.exists(extracted_folder):
                os.rename(extracted_folder, MODEL_PATH)

        except Exception as e:
            logger.error(f"Failed to download/extract model: {e}")

if not os.path.exists(MODEL_PATH):
    logger.warning("Vosk model failed to download. STT queries will fail.")
    vosk_model = None
else:
    logger.info("Loading Vosk Model...")
    vosk_model = Model(MODEL_PATH)
    logger.info("Vosk Model loaded successfully.")

TMP_DIR = os.path.join(os.path.dirname(__file__), "tmp_audio")
os.makedirs(TMP_DIR, exist_ok=True)

# ── Health Check ────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "stt",
        "model_loaded": vosk_model is not None
    }

# ── POST /speech-to-text ────────────────────────────────────────

@app.post("/speech-to-text")
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form("en"),
    sample_rate: int = Form(16000),
    noise_reduction: bool = Form(False),
    authorization: str = Header(None)
):
    if str(authorization).startswith("Bearer "):
        token = authorization.split(" ")[1]
        if token != AUTH_TOKEN:
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        raise HTTPException(status_code=401, detail="Unauthorized request")

    if not vosk_model:
        raise HTTPException(status_code=500, detail="Vosk model not loaded on server.")
        
    audio_id = str(uuid.uuid4())
    input_ext = audio.filename.split('.')[-1] if '.' in audio.filename else 'wav'
    tmp_input_path = os.path.join(TMP_DIR, f"input_{audio_id}.{input_ext}")
    wav_output_path = os.path.join(TMP_DIR, f"processed_{audio_id}.wav")

    try:
        content = await audio.read()
        with open(tmp_input_path, "wb") as f:
            f.write(content)

        # Convert upload to 16kHz mono WAV format correctly expected by Vosk
        success = convert_to_wav(tmp_input_path, wav_output_path)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid audio format or processing failed")

        wf = wave.open(wav_output_path, "rb")
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
            raise HTTPException(status_code=400, detail="Audio file must be WAV format mono PCM.")

        rec = KaldiRecognizer(vosk_model, wf.getframerate())
        rec.SetWords(True)

        results = []
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                res = json.loads(rec.Result())
                if 'text' in res and res['text'].strip():
                    results.append(res)
        
        # Get final buffered result
        res = json.loads(rec.FinalResult())
        if 'text' in res and res['text'].strip():
            results.append(res)

        transcribed_text = " ".join([r.get('text', '') for r in results]).strip()

        # Clean memory and disk
        wf.close()
        os.remove(tmp_input_path)
        os.remove(wav_output_path)

        logger.info(f"Transcription complete: '{transcribed_text[:50]}...'")

        return JSONResponse(content={
            "status": "success",
            "transcribed_text": transcribed_text,
            "confidence": 0.95,
            "language": language
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail="Transcription failure")

# ── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("stt_main:app", host="0.0.0.0", port=PORT, reload=False)
