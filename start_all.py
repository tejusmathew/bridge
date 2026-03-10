import subprocess
import time
import os
import sys

# Paths relative to the bridgeapp root
SERVICES = [
    {
        "name": "Avatar Server (5000) [Port 5003]",
        "cmd": "npm start",
        "cwd": r"backend\avatar_service",
        "env": {"PORT": "5003"}
    },
    {
        "name": "TTS API (8001)",
        "cmd": r"venv\Scripts\uvicorn tts_main:app",
        "cwd": r"backend\tts_service",
        "env": {"PORT": "8001"}
    },
    {
        "name": "STT API (8002)",
        "cmd": r"venv\Scripts\uvicorn stt_main:app",
        "cwd": r"backend\stt_service",
        "env": {"PORT": "8002"}
    },
    {
        "name": "Sign Recognition API (8006)",
        "cmd": r"cmd /c venv\Scripts\activate && python api.py",
        "cwd": r"backend\slr_service",
        "env": {"PORT": "8006"}
    },
    {
        "name": "Gateway API (8000)",
        "cmd": r"venv\Scripts\uvicorn gateway_main:app",
        "cwd": r"backend\gateway",
        "env": {"PORT": "8000"}
    },
    {
        "name": "React Frontend (5173)",
        "cmd": "npm run dev",
        "cwd": r"5_frontend_layer"
    }
]

processes = []

def start_all():
    print("Starting all Bridge Platform microservices...\n")
    for svc in SERVICES:
        full_cwd = os.path.join(os.getcwd(), svc["cwd"])
        print(f"[{svc['name']}] Starting in {full_cwd}...")
        
        env = os.environ.copy()
        if "env" in svc:
            env.update(svc["env"])
            
        # Use Popen to run non-blocking
        try:
            p = subprocess.Popen(
                svc["cmd"],
                cwd=full_cwd,
                env=env,
                shell=True,
                stdout=subprocess.DEVNULL, # Suppress voluminous output
                stderr=subprocess.DEVNULL
            )
            processes.append((svc['name'], p))
        except Exception as e:
            print(f"Failed to start {svc['name']}: {e}")
            
    print("\nAll services commanded to start. Waiting 10 seconds for boot up...")
    time.sleep(10)
    print("\n=======================================================")
    print("🚀 Startup sequence complete. Servers should be live.")
    print("✅ Frontend accessible at: http://localhost:5173")
    print("=======================================================\n")
    print("Press Ctrl+C to terminate all services.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down all services...")
        for name, p in processes:
            print(f"Terminating {name}...")
            p.terminate()
        sys.exit(0)

if __name__ == "__main__":
    start_all()
