import json
import os

CONFIG_PATH = os.getenv("CONFIG_PATH", "config.json")

_defaults: dict = {
    "comfyui_url": "http://localhost:8289",
    "models_root": "",
    "image_model": {
        "format": "fp16",
        "unet":   "z_image_turbo_bf16.safetensors",
        "clip1":  "qwen_3_4b.safetensors",
        "vae":    "ae.safetensors",
    },
    "video_model": {
        "format":                "fp8",
        "unet":                  "ltx-2.3-22b-distilled_transformer_only_fp8_scaled.safetensors",
        "vae":                   "LTX23_video_vae_bf16.safetensors",
        "audio_vae":             "LTX23_audio_vae_bf16.safetensors",
        "clip1":                 "gemma-3-12b-it-qat-UD-Q4_K_XL.gguf",
        "clip2":                 "ltx-2.3_text_projection_bf16.safetensors",
        "distill_lora":          "",
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
