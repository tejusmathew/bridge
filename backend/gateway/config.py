import os
from dotenv import load_dotenv

load_dotenv()

# Microservice Endpoints
# Input Layer
STT_URL = os.getenv("STT_URL", "http://localhost:8002/speech-to-text")

# AI Processing Layer
SLR_URL = os.getenv("SLR_URL", "http://localhost:8006/generate-transcript")

# Output Layer
TTS_URL = os.getenv("TTS_URL", "http://localhost:8001/generate-speech")
AVATAR_URL = os.getenv("AVATAR_URL", "http://localhost:5000/generate-sign-video")

# Authentication Token used across all internal microservices
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "bridge-dev-token-123")
HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}"
}

# Server
PORT = int(os.getenv("PORT", "8000"))
