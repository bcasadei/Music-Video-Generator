from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from routes import audio, generate, characters, settings
from db import init_db
import traceback
import os

app = FastAPI(title="MusicVid API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"\n=== UNHANDLED EXCEPTION ===\n{tb}\n===========================\n")
    return JSONResponse(status_code=500, content={"detail": str(exc), "traceback": tb})


app.include_router(audio.router,      prefix="/audio",      tags=["audio"])
app.include_router(generate.router,   prefix="/generate",   tags=["generate"])
app.include_router(characters.router, prefix="/characters",  tags=["characters"])
app.include_router(settings.router,   prefix="/settings",   tags=["settings"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/download")
def download_file(path: str):
    if not os.path.isfile(path):
        return JSONResponse(status_code=404, content={"detail": "File not found"})
    return FileResponse(path, media_type="video/mp4", filename=os.path.basename(path))
