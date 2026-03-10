$ErrorActionPreference = "Stop"

$baseDir = "c:\Users\TejusMATHEW\Dev\bridge"

Write-Host "Installing frontend..."
cd "$baseDir\5_frontend_layer"
npm install

Write-Host "Installing avatar_service..."
cd "$baseDir\backend\avatar_service"
npm install

# Python 3.11 path (required for SLR service)
$python311 = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"

$pyServices = @(
    "backend\tts_service",
    "backend\stt_service",
    "backend\slr_service",
    "backend\gateway"
)

foreach ($svc in $pyServices) {
    Write-Host "Installing $svc..."
    cd "$baseDir\$svc"
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env" -Force
    }
    # Use Python 3.11 for SLR service, default python for others
    if ($svc -eq "backend\slr_service") {
        Write-Host "  Using Python 3.11 for SLR service..."
        & $python311 -m venv venv
    } else {
        python -m venv venv
    }
    .\venv\Scripts\python.exe -m pip install --upgrade pip
    .\venv\Scripts\pip.exe install -r requirements.txt
}

Write-Host "Downloading STT model..."
cd "$baseDir\backend\stt_service"
.\venv\Scripts\python.exe download_model.py

Write-Host "ALL INSTALLATIONS COMPLETE."
