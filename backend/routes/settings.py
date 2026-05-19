import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from config import load_config, save_config
from typing import Any

router = APIRouter()


class SettingsPayload(BaseModel):
    model_config = {"extra": "allow"}

    comfyui_url:  str | None          = None
    models_root:  str | None          = None
    image_model:  dict[str, Any] | None = None
    video_model:  dict[str, Any] | None = None
    ollama_model: str | None          = None
    ollama_url:   str | None          = None


@router.get("/")
def get_settings():
    return load_config()


@router.post("/")
def update_settings(body: SettingsPayload):
    current = load_config()
    patch   = body.model_dump(exclude_none=True)
    current.update(patch)
    save_config(current)
    return current


@router.get("/scan")
def scan_models(root: str):
    """Scan a ComfyUI models folder and return filenames grouped by subfolder."""
    subdirs = {
        "checkpoints":          ["checkpoints"],
        "loras":                ["loras"],
        "diffusion_models":     ["diffusion_models", "unet"],
        "gguf":                 ["gguf"],
        "vae":                  ["vae"],
        "text_encoders":        ["text_encoders", "clip"],
        "latent_upscale_models": ["latent_upscale_models", "upscale_models"],
    }
    result: dict[str, list[str]] = {k: [] for k in subdirs}
    base = Path(root)
    for key, folders in subdirs.items():
        seen: set[str] = set()
        for folder in folders:
            p = base / folder
            if p.is_dir():
                for f in sorted(p.rglob("*")):
                    if f.is_file() and f.suffix.lower() in (".safetensors", ".gguf", ".pt", ".bin") and f.name not in seen:
                        result[key].append(f.name)
                        seen.add(f.name)
    return result
