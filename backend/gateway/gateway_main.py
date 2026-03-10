import logging

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import config

# ── Logging ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ── FastAPI App ─────────────────────────────────────────────────

app = FastAPI(title="Communication Kernel Gateway API", description="Central router for the Bridge Platform microservices.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health Check ────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "gateway"
    }

# --- WebSocket Signaling Manager (WhatsApp-style E2E Routing) ---
class ConnectionManager:
    def __init__(self):
        # Maps username -> WebSocket connection
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, username: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[username] = websocket
        logger.info(f"User Connected: {username}")

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]
            logger.info(f"User Disconnected: {username}")

    async def send_personal_message(self, message: dict, recipient: str):
        if recipient in self.active_connections:
            await self.active_connections[recipient].send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(username, websocket)
    try:
        while True:
            # Expecting JSON: {"to": "recipient_username", "payload": "encrypted_AES_blob"}
            data = await websocket.receive_json()
            recipient = data.get("to")
            
            if recipient:
                # Add sender context so the recipient knows who it's from
                data["from"] = username 
                await manager.send_personal_message(data, recipient)
                
    except WebSocketDisconnect:
        manager.disconnect(username)

# --- Legacy chained routes removed. Kernel now purely isolates Inputs to Text, and Text to Outputs. ---

@app.post("/api/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """Convert Audio to Pivot Text"""
    try:
        audio_content = await audio.read()
        files = {"audio": (audio.filename, audio_content, audio.content_type)}
        async with httpx.AsyncClient(timeout=180.0) as client:
            stt_res = await client.post(config.STT_URL, headers=config.HEADERS, files=files)
            if stt_res.status_code != 200:
                raise HTTPException(status_code=stt_res.status_code, detail=f"STT Service Error: {stt_res.text}")
            return JSONResponse(content=stt_res.json())
    except httpx.RequestError as e:
        logger.error(f"STT microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")
    except Exception as e:
        logger.error(f"STT proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sign-to-text")
async def sign_to_text(video: UploadFile = File(...)):
    """Convert Video to Pivot Text via inference_simple (port 8006)"""
    try:
        video_content = await video.read()
        # Port 8006 expects the file field to be named 'file', not 'video'
        files = {"file": (video.filename, video_content, video.content_type)}
        async with httpx.AsyncClient(timeout=180.0) as client:
            slr_res = await client.post(config.SLR_URL, files=files)
            if slr_res.status_code != 200:
                raise HTTPException(status_code=slr_res.status_code, detail=f"SLR Service Error: {slr_res.text}")
            # Map 8006's response format for backward compatibility
            result = slr_res.json()
            return JSONResponse(content={
                "status": result.get("status", "success"),
                "transcribed_text": result.get("transcript", ""),
                "confidence": 0.95,
                "language": "en"
            })
    except httpx.RequestError as e:
        logger.error(f"SLR microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")
    except Exception as e:
        logger.error(f"SLR proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text-to-sign")
async def text_to_sign(text: str = Form(...)):
    """Proxy directly to Avatar API"""
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            avatar_res = await client.post(config.AVATAR_URL, headers=config.HEADERS, json={"text": text})
            if avatar_res.status_code != 200:
                raise HTTPException(status_code=avatar_res.status_code, detail=f"Avatar Service Error: {avatar_res.text}")
            return JSONResponse(content=avatar_res.json())
    except httpx.RequestError as e:
        logger.error(f"Avatar microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")

@app.post("/api/text-to-speech")
async def text_to_speech(text: str = Form(...)):
    """Proxy directly to TTS API"""
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            tts_res = await client.post(config.TTS_URL, headers=config.HEADERS, json={"text": text})
            if tts_res.status_code != 200:
                raise HTTPException(status_code=tts_res.status_code, detail=f"TTS Service Error: {tts_res.text}")
            return JSONResponse(content=tts_res.json())
    except httpx.RequestError as e:
        logger.error(f"TTS microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")

# ── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("gateway_main:app", host="0.0.0.0", port=config.PORT, reload=False)
