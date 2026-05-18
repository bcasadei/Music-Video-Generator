import json
import os

CONFIG_PATH = os.getenv("CONFIG_PATH", "config.json")

_defaults: dict = {
    "comfyui_url": "http://localhost:8289",
    "models_root": "",
    "image_model": {
        "format": "fp16",  # "fp16" | "fp8" | "gguf"
        "unet":   "",      # z_image_turbo_bf16.safetensors
        "vae":    "",      # ae.safetensors (Flux VAE)
        "clip1":  "",      # qwen_3_4b.safetensors
    },
    "video_model": {
        "format":                "fp16",  # "fp16" | "fp8" | "gguf"
        "unet":                  "",      # ltx-2.3-..._fp8.safetensors or .gguf
        "vae":                   "",      # LTX23_video_vae_bf16.safetensors
        "audio_vae":             "",      # taeltx2_3.safetensors
        "clip1":                 "",      # gemma_3_12B_it_fpmixed.safetensors
        "clip2":                 "",      # ltx-2.3_text_projection_bf16.safetensors
        "distill_lora":          "",      # ltx-2.3-22b-distilled-lora-384.safetensors
        "distill_lora_strength": 0.6,
    },
    "ollama_model": "llama3.2",
    "ollama_url":   "http://localhost:11434",
}


def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        return dict(_defaults)
    with open(CONFIG_PATH) as f:
        data = json.load(f)
    merged = dict(_defaults)
    merged.update(data)
    return merged


def save_config(data: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)
