from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from services.whisper import transcribe_audio
from services.beat import detect_beats
import aiofiles
import os
import uuid

router = APIRouter()

SUPPORTED_FORMATS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm"}
UPLOAD_DIR = "uploads/audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}. Supported: {', '.join(SUPPORTED_FORMATS)}")

    file_id = str(uuid.uuid4())
    dest = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    try:
        async with aiofiles.open(dest, "wb") as f:
            await f.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File save failed: {e}")

    try:
        segments = await transcribe_audio(dest)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    try:
        beats = await detect_beats(dest)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Beat detection failed: {e}")

    return JSONResponse({
        "file_id": file_id,
        "filename": file.filename,
        "path": dest,
        "segments": segments,
        "beats": beats["beats"],
        "bpm": beats["bpm"],
    })
