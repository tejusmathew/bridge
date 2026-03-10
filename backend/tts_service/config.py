import os
from dotenv import load_dotenv

load_dotenv()

AUTH_TOKEN = os.getenv("AUTH_TOKEN", "bridge-dev-token-123")
PORT = int(os.getenv("PORT", "8001"))
BASE_URL = os.getenv("BASE_URL", f"http://localhost:{PORT}")
