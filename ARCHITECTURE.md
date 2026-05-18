# Music Video Generator — Architecture Plan

**Last updated:** 2026-05-17  
**Status:** Frontend complete — backend next  
**Goal:** Local web app that generates synced music videos from an MP3 + character image — a free alternative to OpenArt.ai's $5/video feature.

---

## 1. Project Overview

### Problem
OpenArt.ai charges ~$5 per music video. The Pixaroma Discord community runs regular challenges with no monetary prize, making paid tools impractical.

### Solution
A locally-hosted web app with:
- Human-in-the-loop clip approval (no fire-and-forget black box)
- Visual style presets (cinematic, surreal, retro, cyberpunk)
- Support for models users already own
- Zero cloud dependency after install

### What was validated
Tested VRGameDevGirl's LTX 2.3 Music Video Prompt Creator V5 workflow (2026-05-16):
- Confirmed LTX Video 2.3 does native audio-driven lipsync via ComfyUI
- VRGDG workflow is fragile: LLM inside ComfyUI nodes required custom llama-cpp-python compile for Blackwell (sm_120)
- No human review step; 2.5-minute video took 4 hours end-to-end
- Our architecture avoids all of these issues by design

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│         (Clip Builder UI + Queue + Settings + Preview)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                      FastAPI Backend                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Whisper   │  │    Ollama    │  │   ComfyUI API Client   │ │
│  │(transcribe) │  │(scene prompts│  │ (workflow builder +    │ │
│  │            │  │ via HTTP)    │  │  job polling)          │ │
│  └─────────────┘  └──────────────┘  └────────────┬───────────┘ │
│                                                   │             │
│  ┌────────────────────────────────────────────────▼───────────┐ │
│  │                    FFmpeg                                  │ │
│  │          (clip concat + audio mux → final MP4)             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                           │ HTTP :8289
┌──────────────────────────▼──────────────────────────────────────┐
│              Bundled ComfyUI (port 8289)                        │
│  Core nodes + ComfyUI-GGUF + ComfyUI-LTXVideo                  │
│  Reads models from user-configured path via extra_model_paths   │
└─────────────────────────────────────────────────────────────────┘
```

### Key design decisions
- **LLM runs in FastAPI via Ollama** — not inside ComfyUI nodes. Avoids llama-cpp-python compile issues entirely.
- **ComfyUI is bundled with the app** — pinned version, only required custom nodes installed. No conflicts with the user's existing ComfyUI installation.
- **Bundled ComfyUI runs on port 8289** — user's existing ComfyUI stays on 8188 untouched.
- **Models stay where they are** — `extra_model_paths.yaml` points ComfyUI at the user's existing models folder. No file copying.

---

## 3. Tech Stack

### Frontend
- **React + TypeScript**
- **Tailwind CSS + shadcn/ui** — component library
- **Zustand** — global state (clip queue, generation status, settings)
- **react-dropzone** — MP3 and image upload
- **WebSocket** — real-time generation progress from FastAPI

### Backend
- **Python 3.12** (embedded portable — see Section 6)
- **FastAPI + Uvicorn** — API server
- **SQLModel + SQLite** — persistence (characters, future: projects/clip history)
- **openai-whisper** — MP3 transcription + lyric timestamps
- **ollama** (Python client) — scene prompt generation via local LLM
- **httpx** — async ComfyUI API calls
- **FFmpeg** (system binary or bundled) — final clip assembly

### ComfyUI (bundled)
- Pinned ComfyUI commit cloned during install
- Custom nodes:
  - `city96/ComfyUI-GGUF` — GGUF UNet loader
  - `Lightricks/ComfyUI-LTXVideo` — LTX Video 2.3 nodes
- All other required nodes (UNETLoader, VAELoader, DualCLIPLoader, LTXVLoader) are ComfyUI core

---

## 4. Generation Pipeline

### Audio → scene segments
```
MP3
 └─ Whisper → word-level timestamps
       └─ Ollama LLM → scene prompt per segment
              └─ stored as segment list: [{start, end, prompt, scene_image}]
```

### Per-clip generation (triggered by "Generate Clip" button)
```
Segment audio slice  ─────────────────────────────────────────┐
                                                               │
Character UNet (fp8/fp16/GGUF)                                 │
  + VAE + CLIP                                                 │
  + style preset prompt                                        │
  → txt2img (KSampler) → character frame                       │
                              │                                │
                              ▼                                ▼
                    LTX Video 2.3 img2video + audio conditioning
                              │
                              ▼
                         clip_N.mp4  (user reviews → approve/reject)
```

### Final assembly
```
Approved clips (ordered queue)
  └─ FFmpeg concat → assembled_video.mp4
        └─ FFmpeg mux full MP3 → final_output.mp4
```

---

## 5. Model Support (V1)

Checkpoints are excluded from V1 — too large, higher VRAM requirement.

### Supported formats

| Format | Files required | Typical VRAM |
|--------|---------------|-------------|
| fp16 diffusion | UNet .safetensors + VAE + CLIP | 12–16 GB |
| fp8 diffusion | UNet .safetensors + VAE + CLIP | 8–12 GB |
| GGUF (Q4/Q5/Q8) | UNet .gguf + VAE + CLIP | 6–12 GB |

VAE and CLIP files are shared across fp8 and GGUF UNet formats.

### ComfyUI loader nodes per format

| Format | UNet loader node |
|--------|----------------|
| fp8 / fp16 | `UNETLoader` (core) |
| GGUF | `UnetLoaderGGUF` (ComfyUI-GGUF) |
| Video (LTX 2.3) | `LTXVLoader` (ComfyUI-LTXVideo) |

### Workflow templates
One JSON template per UNet format, selected by the backend at generation time:

```
backend/workflows/
  img_diffusion.json       ← UNETLoader (fp8 or fp16)
  img_gguf.json            ← UnetLoaderGGUF
  video_ltx.json           ← LTXVLoader + audio conditioning
```

The backend reads `config.json`, selects the right template, injects model paths and prompts, and posts to ComfyUI's `/prompt` endpoint.

---

## 6. Persistence

### SQLite via SQLModel (`app/data/musicvid.db`)

```python
class Character(SQLModel, table=True):
    id:               str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name:             str
    lora_name:        str        # filename in loras/ folder
    trigger_word:     str
    default_strength: float = 0.75
    preview_path:     str = ''   # path to generated preview image
    created_at:       datetime = Field(default_factory=datetime.utcnow)
```

Future tables (post-V1):
```python
class Project(SQLModel, table=True):   # saved clip queue / session
class ClipHistory(SQLModel, table=True) # generated clips with full settings
```

### Settings (`config.json`)
Flat key-value config written by the Settings UI — no DB needed for this.

### Frontend localStorage
Used as a fast-load cache for uploaded character metadata so the UI is populated before the API responds. Backend is the source of truth — localStorage is invalidated when the backend returns its own list.

---

## 8. Model Path Configuration

### extra_model_paths.yaml (written during setup)
```yaml
user_models:
  base_path: F:/AI/models/
  unet: unet/
  vae: vae/
  clip: clip/
  loras: loras/
  gguf: gguf/
```

Users with models inside their existing ComfyUI folder point `base_path` at `F:/AI/ComfyUI/models/` instead. No files move.

### config.json (written by settings UI)
```json
{
  "comfyui_port": 8289,
  "models_root": "F:/AI/models/",
  "image_model": {
    "format": "gguf",
    "unet": "F:/AI/models/gguf/flux1-dev-Q4_K_M.gguf",
    "vae": "F:/AI/models/vae/ae.safetensors",
    "clip": "F:/AI/models/clip/t5xxl_fp8_e4m3fn.safetensors"
  },
  "video_model": {
    "format": "fp16",
    "path": "F:/AI/models/video/ltx_video_2.3_distilled.safetensors"
  },
  "ollama_model": "llama3.2",
  "ollama_url": "http://localhost:11434"
}
```

---

## 9. UX Flow

### First-run setup wizard
```
1. Models folder     → [ Browse ] pick root models directory
2. Image model       → format picker (fp8 / fp16 / GGUF)
                       → UNet file dropdown (scanned from models folder)
                       → VAE + CLIP file dropdowns
3. Video model       → LTX Video file dropdown
4. Ollama model      → text field (default: llama3.2)
5. Done              → config.json written, ComfyUI started
```

### Main app — Clip Builder
```
┌─────────────────────────────┬──────────────────────────────────┐
│        CLIP BUILDER         │          CLIP QUEUE              │
│                             │                                  │
│  [Upload MP3]               │  1. ✅ Intro (0:00–0:12)        │
│  ████████████ waveform      │  2. ✅ Verse 1 (0:12–0:45)      │
│                             │  3. ⏳ Chorus (0:45–1:10)       │
│  Segment: 0:45 → 1:10       │  4. — (empty)                   │
│  [◀──────●────────▶]        │                                  │
│                             │  [↑][↓] drag to reorder         │
│  Scene image: [Browse]      │                                  │
│  [scene_image_preview]      │  [Assemble Final MP4]            │
│                             │                                  │
│  Style: [Neon Nights ▼]     │                                  │
│  Strength: [────●──] 0.7    │                                  │
│                             │                                  │
│  [Generate Clip]            │                                  │
│                             │                                  │
│  ▶ [clip preview]           │                                  │
│  [✅ Approve] [❌ Reject]   │                                  │
└─────────────────────────────┴──────────────────────────────────┘
```

### Style presets (V1)
- **Dalí Dreamscape** — melting forms, 70s color grade, surreal
- **Neon Nights** — cyberpunk, VHS glitch, CRT bloom
- **Cinematic Haze** — volumetric fog, shallow DOF, color grading
- **Retro Technicolor** — 60s–70s film stock look

---

## 10. Python Environment & Installer

### Approach: Embedded Python + uv (same pattern as Ivo's ComfyUI Easy Install)

Rationale: Target users likely have multiple Python versions on their system. Embedding Python keeps the app fully isolated — nothing touches system `PATH`.

### install.bat flow
```
1. Download python-3.12.10-embed-amd64.zip → extract to app/python/
2. Download get-pip.py → bootstrap pip
3. python/python.exe -m pip install uv
4. python/python.exe -m uv sync          ← reads pyproject.toml
                                            pulls torch cu130 + all backend deps
5. git clone ComfyUI (pinned commit) → app/comfyui/
6. Install custom nodes (ComfyUI-GGUF, ComfyUI-LTXVideo)
7. cd frontend && npm install && npm run build
8. Done — run start.bat to launch
```

### start.bat
```
app/python/python.exe -m uvicorn backend.main:app --port 8000
(ComfyUI started by FastAPI on port 8289 as a subprocess)
start http://localhost:3000
```

All scripts reference `app/python/python.exe` explicitly — system Python is never called.

---

## 11. Folder Structure

```
Music_Video_Generator/
├── install.bat                  ← one-click installer
├── start.bat                    ← launches backend + opens browser
├── config.json                  ← written by setup wizard (gitignored)
├── ARCHITECTURE.md
│
├── app/
│   ├── python/                  ← embedded Python 3.12 (gitignored)
│   └── comfyui/                 ← bundled ComfyUI clone (gitignored)
│       ├── extra_model_paths.yaml  ← written by setup wizard
│       └── custom_nodes/
│           ├── ComfyUI-GGUF/
│           └── ComfyUI-LTXVideo/
│
├── backend/
│   ├── main.py                  ← FastAPI app entry
│   ├── routers/
│   │   ├── generate.py          ← clip generation endpoints
│   │   ├── audio.py             ← Whisper transcription
│   │   ├── assembly.py          ← FFmpeg final export
│   │   └── settings.py         ← config read/write
│   ├── services/
│   │   ├── comfyui_client.py    ← workflow builder + job polling
│   │   ├── whisper_service.py
│   │   ├── ollama_service.py
│   │   └── ffmpeg_service.py
│   └── workflows/               ← ComfyUI JSON templates
│       ├── img_diffusion.json
│       ├── img_gguf.json
│       └── video_ltx.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ClipBuilder/
│   │   │   ├── ClipQueue/
│   │   │   ├── Waveform/
│   │   │   └── Settings/
│   │   ├── store/               ← Zustand state
│   │   └── App.tsx
│   └── package.json
│
├── presets/                     ← style preset prompt templates
├── output/                      ← generated clips + final MP4 (gitignored)
└── support/
```

---

## 12. Out of Scope for V1

| Feature | Reason deferred |
|---------|----------------|
| Checkpoint models (.safetensors all-in-one) | Large VRAM requirement; GGUF/fp8 covers the use case |
| LoRA training | Requires video training data; hard on RTX 5070 Ti; V2 feature |
| Character LoRA upload | Deferred — Z-Image preset LoRAs ship with app in V1 |
| Optical flow / frame interpolation | Added complexity; LTX output quality sufficient for V1 |
| Cloud deployment | Local-only by design in V1 |
| OpenRouter LLM fallback | Ollama assumed available; fallback is V1.1 |
| Separate lipsync tool (SadTalker etc.) | LTX 2.3 audio conditioning handles this natively |
