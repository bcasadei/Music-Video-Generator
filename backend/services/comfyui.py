import httpx
import asyncio
import json
import os
import uuid
from pathlib import Path
from config import load_config

WORKFLOWS_DIR = Path(__file__).parent.parent / "workflows"
OUTPUT_DIR    = "outputs/clips"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def _num_frames(duration_secs: float, fps: int) -> int:
    return max(9, int(duration_secs * fps))


def _load_template(fmt: str) -> dict:
    name = "img_gguf.json" if fmt == "gguf" else "img_diffusion.json"
    with open(WORKFLOWS_DIR / name) as f:
        return json.load(f)


def _inject(workflow: dict, values: dict) -> dict:
    """Replace all \"{{PLACEHOLDER}}\" strings in the workflow with real values."""
    raw = json.dumps(workflow)
    for key, val in values.items():
        raw = raw.replace(f'"{{{{{{key}}}}}}"', json.dumps(val))
    return json.loads(raw)



async def _upload_audio(url: str, audio_path: str) -> str:
    """Upload audio file to ComfyUI input folder. Returns the filename ComfyUI assigned."""
    filename = os.path.basename(audio_path)
    async with httpx.AsyncClient() as client:
        with open(audio_path, "rb") as f:
            resp = await client.post(
                f"{url}/upload/audio",
                files={"audio": (filename, f, "audio/mpeg")},
                timeout=30,
            )
        resp.raise_for_status()
        return resp.json().get("name", filename)


async def run_clip_workflow(
    prompt: str,
    lora_name: str,
    lora_strength: float,
    audio_path: str,
    segment_start: float,
    segment_end: float,
    resolution: str,
    fps: int,
    job_id: str,
    on_progress=None,   # optional async callable(pct: int, msg: str)
) -> str:
    cfg  = load_config()
    img  = cfg["image_model"]
    vid  = cfg["video_model"]
    url  = cfg.get("comfyui_url", "http://localhost:8289")

    res_map = {"1080p": (1920, 1080), "720p": (1280, 720), "480p": (854, 480)}
    width, height = res_map.get(resolution, (1280, 720))
    duration      = segment_end - segment_start

    img_fmt          = img.get("format", "fp16")
    zimg_weight_type = "fp8_e4m3fn" if img_fmt == "fp8" else "default"
    ltx_fmt          = vid.get("format", "fp16")
    ltx_weight_type  = "fp8_e4m3fn" if ltx_fmt == "fp8" else "default"

    audio_filename = await _upload_audio(url, audio_path)

    values = {
        # Z-Image model
        "ZIMG_UNET_NAME":    os.path.basename(img.get("unet", "")),
        "ZIMG_WEIGHT_DTYPE": zimg_weight_type,
        "ZIMG_CLIP_NAME":    os.path.basename(img.get("clip1", "")),
        "ZIMG_VAE_NAME":     os.path.basename(img.get("vae", "")),
        # Character LoRA
        "LORA_NAME":         lora_name,
        "LORA_STRENGTH":     lora_strength,
        # Prompt + seed
        "POSITIVE_PROMPT":   prompt,
        "SEED":              uuid.uuid4().int % (2**32),
        # LTX video model
        "LTX_UNET_NAME":             os.path.basename(vid.get("unet", "")),
        "LTX_WEIGHT_DTYPE":          ltx_weight_type,
        "LTX_DISTILL_LORA_NAME":     os.path.basename(vid.get("distill_lora", "")),
        "LTX_DISTILL_LORA_STRENGTH": vid.get("distill_lora_strength", 0.6),
        "LTX_CLIP_NAME1":            os.path.basename(vid.get("clip1", "")),
        "LTX_CLIP_NAME2":            os.path.basename(vid.get("clip2", "")),
        "LTX_VIDEO_VAE_NAME":        os.path.basename(vid.get("vae", "")),
        "LTX_AUDIO_VAE_NAME":        os.path.basename(vid.get("audio_vae", "")),
        "LTX_NEGATIVE_PROMPT":       "worst quality, inconsistent motion, blurry, jittery, distorted",
        # Audio
        "AUDIO_FILENAME":    audio_filename,
        "SEGMENT_START":     segment_start,
        "SEGMENT_DURATION":  duration,
        # Video params
        "WIDTH":      width,
        "HEIGHT":     height,
        "FPS":        fps,
        "NUM_FRAMES": _num_frames(duration, fps),
        "JOB_ID":     job_id,
    }

    template = _load_template(img_fmt)
    workflow  = _inject(template, values)

    # If no distill LoRA, remove node 13 and wire CFGGuider directly to the LTX UNET
    if not vid.get("distill_lora"):
        workflow.pop("13", None)
        if "27" in workflow:
            workflow["27"]["inputs"]["model"] = ["12", 0]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{url}/prompt",
            json={"prompt": workflow, "client_id": job_id},
            timeout=30,
        )
        resp.raise_for_status()
        prompt_id = resp.json()["prompt_id"]

    return await _poll_for_output(prompt_id, job_id, url, on_progress=on_progress)


async def _poll_for_output(
    prompt_id: str,
    job_id: str,
    url: str,
    timeout: int = 600,
    on_progress=None,
) -> str:
    async with httpx.AsyncClient() as client:
        for elapsed in range(timeout):
            await asyncio.sleep(1)

            # Push a rough progress estimate (15→95%) via callback
            if on_progress and elapsed % 5 == 0:
                pct = min(95, 15 + int(elapsed / timeout * 80))
                await on_progress(pct, f"Generating… ({elapsed}s)")

            resp    = await client.get(f"{url}/history/{prompt_id}")
            history = resp.json()
            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                for node_output in outputs.values():
                    for key in ("videos", "gifs"):
                        if key in node_output and node_output[key]:
                            item      = node_output[key][0]
                            filename  = item["filename"]
                            subfolder = item.get("subfolder", "")
                            params    = {"filename": filename, "type": "output"}
                            if subfolder:
                                params["subfolder"] = subfolder
                            file_resp = await client.get(f"{url}/view", params=params, timeout=60)
                            file_resp.raise_for_status()
                            dest = os.path.join(OUTPUT_DIR, filename)
                            with open(dest, "wb") as f:
                                f.write(file_resp.content)
                            return dest

    raise TimeoutError(f"Job {job_id} timed out after {timeout}s")
