from fastapi import APIRouter
from fastapi.staticfiles import StaticFiles
import os
import json

router = APIRouter()
PRESETS_DIR = "../../presets/characters"


@router.get("/characters")
def list_characters():
    """Return all preset characters with metadata."""
    characters = []
    for name in os.listdir(PRESETS_DIR):
        meta_path = os.path.join(PRESETS_DIR, name, "meta.json")
        if os.path.isfile(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
            characters.append({
                "id": name,
                "preview": f"/presets/{name}/preview.png",
                **meta,
            })
    return characters
