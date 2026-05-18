from fastapi import APIRouter, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from services.llm import generate_scene_prompt
from services.comfyui import run_clip_workflow
from services.ffmpeg import assemble_video
import jobs
import asyncio
import json

router = APIRouter()

WS_POLL_INTERVAL = 0.5   # seconds between job-state checks inside the WebSocket


class ClipRequest(BaseModel):
    file_id:         str
    segment_start:   float
    segment_end:     float
    segment_lyrics:  str
    lora_name:       str
    lora_strength:   float
    trigger_word:    str
    style_tags:      list[str]
    resolution:      str        # "1080p" | "720p" | "480p"
    fps:             int
    transition:      str        # "dissolve" | "cut" | "fade"
    global_context:  dict       # story_concept, locations, etc.


class AssembleRequest(BaseModel):
    clip_paths:      list[str]
    audio_path:      str
    transition:      str
    output_filename: str


@router.post("/clip")
async def generate_clip(req: ClipRequest, background_tasks: BackgroundTasks):
    job_id = f"clip_{req.file_id}_{int(req.segment_start)}"
    await jobs.create(job_id)
    background_tasks.add_task(_run_clip_job, job_id, req)
    return {"job_id": job_id}


@router.get("/clip/{job_id}")
async def clip_status(job_id: str):
    job = await jobs.get(job_id)
    if not job:
        return {"error": "job not found"}
    return {
        "job_id":    job.id,
        "status":    job.status,
        "progress":  job.progress,
        "message":   job.message,
        "clip_path": job.clip_path,
        "error":     job.error,
    }


@router.post("/assemble")
async def assemble(req: AssembleRequest):
    output_path = await assemble_video(
        clip_paths=req.clip_paths,
        audio_path=req.audio_path,
        transition=req.transition,
        output_filename=req.output_filename,
    )
    return {"output_path": output_path}


@router.websocket("/ws/{job_id}")
async def job_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    try:
        while True:
            job = await jobs.get(job_id)
            if not job:
                await websocket.send_text(json.dumps({"error": "job not found"}))
                break

            await websocket.send_text(json.dumps({
                "job_id":    job.id,
                "status":    job.status,
                "progress":  job.progress,
                "message":   job.message,
                "clip_path": job.clip_path,
                "error":     job.error,
            }))

            if job.status in ("done", "error"):
                break

            await asyncio.sleep(WS_POLL_INTERVAL)
    except WebSocketDisconnect:
        pass


async def _run_clip_job(job_id: str, req: ClipRequest):
    try:
        await jobs.update(job_id, status="generating", progress=5, message="Generating scene prompt…")

        prompt = await generate_scene_prompt(
            lyrics=req.segment_lyrics,
            style_tags=req.style_tags,
            global_context=req.global_context,
            trigger_word=req.trigger_word,
        )

        await jobs.update(job_id, progress=15, message="Submitting to ComfyUI…")

        async def _progress(pct: int, msg: str):
            await jobs.update(job_id, progress=pct, message=msg)

        clip_path = await run_clip_workflow(
            prompt=prompt,
            lora_name=req.lora_name,
            lora_strength=req.lora_strength,
            audio_path=f"uploads/audio/{req.file_id}",
            segment_start=req.segment_start,
            segment_end=req.segment_end,
            resolution=req.resolution,
            fps=req.fps,
            job_id=job_id,
            on_progress=_progress,
        )

        await jobs.update(job_id, status="done", progress=100, message="Done.", clip_path=clip_path)

    except Exception as exc:
        await jobs.update(job_id, status="error", message="Generation failed.", error=str(exc))
