---
description: how to run the Bridge Platform backend microservices
---

To start all microservices (STT, TTS, SLR, Avatar, and Gateway) simultaneously:

1. **Open a terminal** in the project root: `d:\bridgeapp`.
2. **Execute the startup script**:
   ```powershell
   python start_all.py
   ```
3. **Wait for initialization**: The script will wait 10 seconds to allow all Uvicorn and Node.js servers to bind to their respective ports.
4. **Ports activated**:
   - Gateway API: `8000`
   - TTS Service: `8001`
   - STT Service: `8002`
   - SLR Service: `8003`
   - Avatar Engine: `5000`

// turbo
5. **Verify the integration** (Optional):
   In a separate terminal, run the gateway test script:
   ```powershell
   d:\bridgeapp\3_communication_kernel\gateway_api\venv\Scripts\python.exe d:\bridgeapp\3_communication_kernel\gateway_api\test_gateway.py
   ```

To stop all services, simply press `Ctrl+C` in the terminal running `start_all.py`.
