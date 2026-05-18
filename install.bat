@echo off
setlocal enabledelayedexpansion
title MusicVid — Setup

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       MusicVid — First-time Setup    ║
echo  ╚══════════════════════════════════════╝
echo.

REM ── Prerequisites check ────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found.
    echo          Install Python 3.11+ from https://www.python.org/downloads/
    echo          Make sure to tick "Add Python to PATH" during install.
    pause & exit /b 1
)

git --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Git not found.
    echo          Install Git from https://git-scm.com/download/win
    pause & exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found.
    echo          Install Node.js 20+ from https://nodejs.org/
    pause & exit /b 1
)

echo  [OK] Python, Git and Node.js found.
echo.

REM ── Frontend ────────────────────────────────────────────────────────────────
echo  [1/5] Installing frontend dependencies...
cd frontend
call npm install --silent
if errorlevel 1 ( echo  [ERROR] npm install failed. & pause & exit /b 1 )
cd ..
echo        Done.

REM ── Backend ─────────────────────────────────────────────────────────────────
echo  [2/5] Installing backend dependencies...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\pip install -q -r requirements.txt
if errorlevel 1 ( echo  [ERROR] pip install failed. & pause & exit /b 1 )
cd ..
echo        Done.

REM ── ComfyUI ─────────────────────────────────────────────────────────────────
echo  [3/5] Setting up ComfyUI...
if not exist comfyui (
    echo        Cloning ComfyUI...
    git clone --depth 1 https://github.com/comfyanonymous/ComfyUI comfyui
    if errorlevel 1 ( echo  [ERROR] Failed to clone ComfyUI. & pause & exit /b 1 )
) else (
    echo        ComfyUI already cloned, skipping.
)

if not exist comfyui\venv (
    echo        Creating ComfyUI Python environment...
    cd comfyui
    python -m venv venv

    echo        Installing PyTorch (CUDA 12.8 — for RTX 4000/5000 series)...
    call venv\Scripts\pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
    if errorlevel 1 (
        echo        cu128 failed, trying cu124...
        call venv\Scripts\pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
    )

    echo        Installing ComfyUI requirements...
    call venv\Scripts\pip install -q -r requirements.txt
    cd ..
) else (
    echo        ComfyUI venv already exists, skipping.
)
echo        Done.

REM ── Custom nodes ────────────────────────────────────────────────────────────
echo  [4/5] Installing ComfyUI custom nodes...
cd comfyui\custom_nodes

if not exist ComfyUI-GGUF (
    echo        Cloning ComfyUI-GGUF...
    git clone --depth 1 https://github.com/city96/ComfyUI-GGUF
    call ..\venv\Scripts\pip install -q -r ComfyUI-GGUF\requirements.txt
)

if not exist ComfyUI-LTXVideo (
    echo        Cloning ComfyUI-LTXVideo...
    git clone --depth 1 https://github.com/Lightricks/ComfyUI-LTXVideo
    call ..\venv\Scripts\pip install -q -r ComfyUI-LTXVideo\requirements.txt
)

if not exist ComfyUI-VideoHelperSuite (
    echo        Cloning ComfyUI-VideoHelperSuite...
    git clone --depth 1 https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
    if exist ComfyUI-VideoHelperSuite\requirements.txt (
        call ..\venv\Scripts\pip install -q -r ComfyUI-VideoHelperSuite\requirements.txt
    )
)

cd ..\..
echo        Done.

REM ── Model directories ───────────────────────────────────────────────────────
echo  [5/5] Creating model folder structure...
mkdir comfyui\models\diffusion_models 2>nul
mkdir comfyui\models\gguf             2>nul
mkdir comfyui\models\vae              2>nul
mkdir comfyui\models\text_encoders    2>nul
mkdir comfyui\models\loras            2>nul
mkdir comfyui\models\checkpoints      2>nul
echo        Done.

REM ── Summary ─────────────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════════════════════╗
echo  ║  Setup complete!                                                     ║
echo  ║                                                                      ║
echo  ║  Next: download your models and place them in:                       ║
echo  ║    comfyui\models\diffusion_models\   ← Z-Image + LTX 2.3 UNETs    ║
echo  ║    comfyui\models\gguf\               ← GGUF variants               ║
echo  ║    comfyui\models\vae\                ← Flux VAE + LTX VAEs         ║
echo  ║    comfyui\models\text_encoders\      ← Qwen CLIP + Gemma + proj    ║
echo  ║    comfyui\models\loras\              ← distill LoRA + char LoRAs   ║
echo  ║                                                                      ║
echo  ║  Then run:  cd frontend  ^&^&  npm run dev                            ║
echo  ║                                                                      ║
echo  ╚══════════════════════════════════════════════════════════════════════╝
echo.
pause
