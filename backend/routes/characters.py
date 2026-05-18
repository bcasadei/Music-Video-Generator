from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from db import Character, get_session
import aiofiles
import os
import uuid

router = APIRouter()

LORA_DIR    = "uploads/loras"
PREVIEW_DIR = "uploads/previews"
os.makedirs(LORA_DIR,    exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

ALLOWED_LORA_EXTS    = {".safetensors", ".gguf", ".pt"}
ALLOWED_PREVIEW_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


class CharacterUpdate(BaseModel):
    name:             str | None = None
    trigger_word:     str | None = None
    default_strength: float | None = None


@router.get("/", response_model=list[Character])
def list_characters(session: Session = Depends(get_session)):
    return session.exec(select(Character)).all()


@router.get("/{character_id}", response_model=Character)
def get_character(character_id: str, session: Session = Depends(get_session)):
    char = session.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.get("/{character_id}/preview")
def get_preview(character_id: str, session: Session = Depends(get_session)):
    char = session.get(Character, character_id)
    if not char or not char.preview_path or not os.path.exists(char.preview_path):
        raise HTTPException(status_code=404, detail="Preview not found")
    return FileResponse(char.preview_path)


@router.post("/", response_model=Character)
async def create_character(
    name:             str        = Form(...),
    trigger_word:     str        = Form(...),
    default_strength: float      = Form(0.75),
    lora_file:        UploadFile = File(...),
    preview_file:     UploadFile | None = File(None),
    session:          Session    = Depends(get_session),
):
    lora_ext = os.path.splitext(lora_file.filename or "")[1].lower()
    if lora_ext not in ALLOWED_LORA_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported LoRA format: {lora_ext}")

    file_id   = str(uuid.uuid4())
    lora_dest = os.path.join(LORA_DIR, f"{file_id}{lora_ext}")
    async with aiofiles.open(lora_dest, "wb") as f:
        await f.write(await lora_file.read())

    preview_path = ""
    if preview_file and preview_file.filename:
        prev_ext = os.path.splitext(preview_file.filename)[1].lower()
        if prev_ext not in ALLOWED_PREVIEW_EXTS:
            raise HTTPException(status_code=400, detail=f"Unsupported preview format: {prev_ext}")
        prev_dest = os.path.join(PREVIEW_DIR, f"{file_id}{prev_ext}")
        async with aiofiles.open(prev_dest, "wb") as f:
            await f.write(await preview_file.read())
        preview_path = prev_dest

    char = Character(
        name=name,
        lora_name=os.path.basename(lora_dest),
        trigger_word=trigger_word,
        default_strength=default_strength,
        preview_path=preview_path,
    )
    session.add(char)
    session.commit()
    session.refresh(char)
    return char


@router.patch("/{character_id}", response_model=Character)
def update_character(
    character_id: str,
    body:         CharacterUpdate,
    session:      Session = Depends(get_session),
):
    char = session.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if body.name is not None:
        char.name = body.name
    if body.trigger_word is not None:
        char.trigger_word = body.trigger_word
    if body.default_strength is not None:
        char.default_strength = body.default_strength
    session.add(char)
    session.commit()
    session.refresh(char)
    return char


@router.delete("/{character_id}")
def delete_character(character_id: str, session: Session = Depends(get_session)):
    char = session.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    for path in [char.preview_path, os.path.join(LORA_DIR, char.lora_name)]:
        if path and os.path.exists(path):
            os.remove(path)
    session.delete(char)
    session.commit()
    return {"ok": True}
