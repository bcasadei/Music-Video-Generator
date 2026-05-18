export type StylePreset = 'Neon Nights' | 'Dalí Dreamscape' | 'Cinematic Haze' | 'Retro Technicolor' | 'Custom'

export interface Character {
  id: string
  name: string
  preview: string       // URL to preview image
  lora_name: string     // filename of .safetensors
  trigger_word: string
  default_strength: number
  uploaded?: boolean    // true for user-uploaded LoRAs, false/absent for presets
}

export interface AudioSegment {
  start: number         // seconds
  end: number           // seconds
  text: string          // whisper transcript
}

export interface AudioFile {
  file_id: string
  filename: string
  path: string
  bpm: number
  segments: AudioSegment[]   // raw whisper segments
  beats: number[]
}

export type DurationPreset = 'varied_no_repeat' | 'impact_weighted' | 'clustered_no_repeat'

export interface SegmentationSettings {
  min_duration: number       // seconds
  max_duration: number       // seconds, capped at 10 for LTX 2.3 local
  bias: number               // 0–1, beat snap strength
  preset: DurationPreset
}

export interface GlobalContext {
  style_theme: string
  story_concept: string
  locations: string
}

export interface ClipConfig {
  id: string
  character: Character
  lora_strength: number
  trigger_word: string
  segment: AudioSegment
  style_preset: StylePreset
  style_tags: string[]
  resolution: '1080p' | '720p'
  fps: number
  transition: 'dissolve' | 'cut' | 'fade'
  generated_prompt?: string  // LLM output, editable by user
}

export interface Clip extends ClipConfig {
  status: 'idle' | 'generating' | 'done' | 'error'
  output_path?: string
  progress?: number
  error?: string
}

export interface AppConfig {
  comfyui_url: string
  models_root: string
  image_model: {
    format: 'fp16' | 'fp8' | 'gguf'
    unet: string    // Z-Image Turbo diffusion model
    clip1: string   // Qwen CLIP from text_encoders/
    vae: string     // Flux VAE from vae/
  }
  video_model: {
    format: 'fp16' | 'fp8' | 'gguf'
    unet: string                  // LTX 2.3 model from diffusion_models/ or gguf/
    vae: string                   // LTX video VAE from vae/
    audio_vae: string             // LTX audio VAE from vae/
    clip1: string                 // Gemma text encoder from text_encoders/
    clip2: string                 // LTX text projection from text_encoders/
    distill_lora: string          // distilled LoRA from loras/
    distill_lora_strength: number
  }
  ollama_url: string
  ollama_model: string
}

export interface ScannedModels {
  checkpoints: string[]            // Z-Image Turbo and other checkpoint models
  loras: string[]                  // character LoRAs
  diffusion_models: string[]       // fp8/fp16 models (LTX, etc.)
  gguf: string[]                   // GGUF variants
  vae: string[]                    // all VAE files
  text_encoders: string[]          // T5, CLIP, text projection files
  latent_upscale_models: string[]  // spatial upscalers
}
