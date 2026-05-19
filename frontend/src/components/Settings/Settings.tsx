import { useState, useEffect } from 'react'
import axios from 'axios'
import type { AppConfig, ScannedModels } from '../../types'

function autoPopulate(m: ScannedModels): { image_model: Partial<AppConfig['image_model']>; video_model: Partial<AppConfig['video_model']> } {
  const find = (files: string[], ...terms: string[]) =>
    files.find((f) => terms.some((t) => f.toLowerCase().includes(t))) ?? ''

  const allDiffusion = [...m.diffusion_models, ...m.gguf]

  return {
    image_model: {
      unet:  find(allDiffusion, 'z_image', 'zimage', 'z-image'),
      clip1: find(m.text_encoders, 'qwen'),
      vae:   find(m.vae, 'ae.safetensors') || find(m.vae, 'fluxvae', 'flux_vae') || find(m.vae, 'ae'),
    },
    video_model: {
      unet:         find(allDiffusion, 'ltx'),
      clip1:        find(m.text_encoders, 'gemma'),
      clip2:        find(m.text_encoders, 'text_projection', 'projection', 'ltx'),
      vae:          find(m.vae, 'video_vae', 'ltx'),
      audio_vae:    find(m.vae, 'taeltx', 'audio_vae', 'audio'),
      distill_lora: find(m.loras, 'distill'),
    },
  }
}

const DEFAULTS: AppConfig = {
  comfyui_url:  'http://localhost:8289',
  models_root:  '',
  image_model:  { format: 'fp16', unet: '', clip1: '', vae: '' },
  video_model:  { format: 'fp16', unet: '', vae: '', audio_vae: '', clip1: '', clip2: '', distill_lora: '', distill_lora_strength: 0.6 },
  ollama_url:   'http://localhost:11434',
  ollama_model: 'llama3.2',
}

export function Settings() {
  const [cfg, setCfg]           = useState<AppConfig>(DEFAULTS)
  const [models, setModels]     = useState<ScannedModels | null>(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [scanError, setScanError]         = useState<string | null>(null)
  const [comfyStatus, setComfyStatus]     = useState<'idle' | 'ok' | 'error'>('idle')
  const [pullStatus, setPullStatus]       = useState<'idle' | 'pulling' | 'done' | 'error'>('idle')
  const [pullProgress, setPullProgress]   = useState<string>('')

  useEffect(() => {
    axios.get('/api/settings').then((r) => setCfg({ ...DEFAULTS, ...r.data })).catch(() => {})
  }, [])

  const setImage = (patch: Partial<AppConfig['image_model']>) =>
    setCfg((c) => ({ ...c, image_model: { ...c.image_model, ...patch } }))

  const setVideo = (patch: Partial<AppConfig['video_model']>) =>
    setCfg((c) => ({ ...c, video_model: { ...c.video_model, ...patch } }))

  const handleScan = async () => {
    if (!cfg.models_root) return
    setScanning(true)
    setScanError(null)
    try {
      const { data } = await axios.get('/api/settings/scan', { params: { root: cfg.models_root } })
      setModels(data)
      const auto = autoPopulate(data)
      setCfg((c) => ({
        ...c,
        image_model: { ...c.image_model, ...Object.fromEntries(Object.entries(auto.image_model).filter(([, v]) => v)) },
        video_model: { ...c.video_model, ...Object.fromEntries(Object.entries(auto.video_model).filter(([, v]) => v)) },
      }))
    } catch {
      setScanError('Could not scan folder — check the path and try again.')
    } finally {
      setScanning(false)
    }
  }

  const handleTestComfyUI = async () => {
    setComfyStatus('idle')
    try {
      await axios.get(`${cfg.comfyui_url}/system_stats`)
      setComfyStatus('ok')
    } catch {
      setComfyStatus('error')
    }
  }

  const handlePullModel = async () => {
    if (!cfg.ollama_model) return
    setPullStatus('pulling')
    setPullProgress('Connecting…')
    try {
      const res = await fetch(`${cfg.ollama_url}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cfg.ollama_model }),
      })
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).trim().split('\n')
        for (const line of lines) {
          try {
            const msg = JSON.parse(line)
            if (msg.status) {
              if (msg.total && msg.completed) {
                const pct = Math.round((msg.completed / msg.total) * 100)
                setPullProgress(`${msg.status} — ${pct}%`)
              } else {
                setPullProgress(msg.status)
              }
            }
          } catch {}
        }
      }
      setPullStatus('done')
      setPullProgress('Done')
    } catch {
      setPullStatus('error')
      setPullProgress('Pull failed — is Ollama running?')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await axios.post('/api/settings', cfg)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const ltxModelFiles = cfg.video_model.format === 'gguf'
    ? (models?.gguf ?? [])
    : (models?.diffusion_models ?? [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-[18px] font-semibold text-[#e2e8f0]">Settings</h2>

      {/* ComfyUI */}
      <Section title="ComfyUI">
        <Field label="URL">
          <div className="flex gap-2">
            <input
              value={cfg.comfyui_url}
              onChange={(e) => setCfg((c) => ({ ...c, comfyui_url: e.target.value }))}
              className={inputCls}
            />
            <button onClick={handleTestComfyUI} className={secondaryBtn}>Test</button>
          </div>
          {comfyStatus === 'ok'    && <Status ok>Connected</Status>}
          {comfyStatus === 'error' && <Status>Not reachable — is ComfyUI running?</Status>}
        </Field>
      </Section>

      {/* Models folder */}
      <Section title="Models Folder">
        <Field label="Root path" hint="Paste the path to your ComfyUI models folder. Expected subfolders: diffusion_models/, text_encoders/, vae/, loras/">
          <div className="flex gap-2">
            <input
              value={cfg.models_root}
              onChange={(e) => { setCfg((c) => ({ ...c, models_root: e.target.value })); setModels(null) }}
              placeholder="F:/AI/ComfyUI/models"
              className={inputCls}
            />
            <button
              onClick={handleScan}
              disabled={!cfg.models_root || scanning}
              className={secondaryBtn + ' disabled:opacity-40'}
            >
              {scanning ? 'Scanning…' : 'Scan'}
            </button>
          </div>
          {scanError && <Status>{scanError}</Status>}
          {models && (
            <Status ok>
              checkpoints: {models.checkpoints.length} · loras: {models.loras.length} · diffusion: {models.diffusion_models.length} · gguf: {models.gguf.length} · vae: {models.vae.length} · text_encoders: {models.text_encoders.length}
            </Status>
          )}
        </Field>
      </Section>

      {/* Image model — Z-Image Turbo */}
      <Section title="Image Model — Z-Image Turbo">
        <Field label="Format">
          <FormatToggle
            options={['fp16', 'fp8', 'gguf']}
            value={cfg.image_model.format}
            onChange={(f) => setImage({ format: f as AppConfig['image_model']['format'], unet: '' })}
          />
        </Field>
        <Field label="Diffusion model (UNET)" hint="From diffusion_models/ or gguf/ — z_image_turbo_bf16 or similar">
          <ModelSelect value={cfg.image_model.unet} options={cfg.image_model.format === 'gguf' ? (models?.gguf ?? []) : (models?.diffusion_models ?? [])}
            onChange={(v) => setImage({ unet: v })} disabled={!models} />
        </Field>
        <Field label="CLIP / text encoder" hint="From text_encoders/ — e.g. qwen_3_4b">
          <ModelSelect value={cfg.image_model.clip1} options={models?.text_encoders ?? []}
            onChange={(v) => setImage({ clip1: v })} disabled={!models} />
        </Field>
        <Field label="VAE" hint="From vae/ — Flux VAE (ae.safetensors)">
          <ModelSelect value={cfg.image_model.vae} options={models?.vae ?? []}
            onChange={(v) => setImage({ vae: v })} disabled={!models} />
        </Field>
      </Section>

      {/* Video model — LTX 2.3 */}
      <Section title="Video Model — LTX Video 2.3">
        <Field label="Format">
          <FormatToggle
            options={['fp16', 'fp8', 'gguf']}
            value={cfg.video_model.format}
            onChange={(f) => setVideo({ format: f as AppConfig['video_model']['format'], unet: '' })}
          />
        </Field>
        <Field label="LTX model (UNET)" hint="From diffusion_models/ (fp8/fp16) or gguf/ (GGUF)">
          <ModelSelect value={cfg.video_model.unet} options={ltxModelFiles}
            onChange={(v) => setVideo({ unet: v })} disabled={!models} />
        </Field>
        <Field label="Text encoder 1 (Gemma)" hint="From text_encoders/ — gemma_3_12B file">
          <ModelSelect value={cfg.video_model.clip1} options={models?.text_encoders ?? []}
            onChange={(v) => setVideo({ clip1: v })} disabled={!models} />
        </Field>
        <Field label="Text encoder 2 (projection)" hint="From text_encoders/ — ltx-2.3-text_projection file">
          <ModelSelect value={cfg.video_model.clip2} options={models?.text_encoders ?? []}
            onChange={(v) => setVideo({ clip2: v })} disabled={!models} />
        </Field>
        <Field label="Video VAE" hint="From vae/ — LTX23_video_vae file">
          <ModelSelect value={cfg.video_model.vae} options={models?.vae ?? []}
            onChange={(v) => setVideo({ vae: v })} disabled={!models} />
        </Field>
        <Field label="Audio VAE" hint="From vae/ — taeltx2_3 file">
          <ModelSelect value={cfg.video_model.audio_vae} options={models?.vae ?? []}
            onChange={(v) => setVideo({ audio_vae: v })} disabled={!models} />
        </Field>
        <Field label="Distill LoRA" hint="From loras/ — ltx-2.3-distilled-lora file">
          <ModelSelect value={cfg.video_model.distill_lora} options={models?.loras ?? []}
            onChange={(v) => setVideo({ distill_lora: v })} disabled={!models} />
        </Field>
        <Field label="Distill LoRA strength">
          <div className="flex items-center gap-3">
            <input
              type="range" min={0} max={100}
              value={cfg.video_model.distill_lora_strength * 100}
              onChange={(e) => setVideo({ distill_lora_strength: Number(e.target.value) / 100 })}
              className="flex-1 accent-[#7c5cfc]"
            />
            <span className="text-[14px] font-mono text-[#a78bfa] w-10 text-right">
              {cfg.video_model.distill_lora_strength.toFixed(2)}
            </span>
          </div>
        </Field>
      </Section>

      {/* Ollama */}
      <Section title="Ollama (Scene Prompts)">
        <Field label="URL">
          <input
            value={cfg.ollama_url}
            onChange={(e) => setCfg((c) => ({ ...c, ollama_url: e.target.value }))}
            className={inputCls}
          />
        </Field>
        <Field label="Model" hint="Must be available in Ollama — type a name and pull it, or enter one already downloaded">
          <div className="flex gap-2">
            <input
              value={cfg.ollama_model}
              onChange={(e) => { setCfg((c) => ({ ...c, ollama_model: e.target.value })); setPullStatus('idle') }}
              placeholder="llama3.2"
              className={inputCls}
            />
            <button
              onClick={handlePullModel}
              disabled={!cfg.ollama_model || pullStatus === 'pulling'}
              className={secondaryBtn + ' disabled:opacity-40'}
            >
              {pullStatus === 'pulling' ? 'Pulling…' : 'Pull'}
            </button>
          </div>
          {pullStatus === 'pulling' && (
            <p className="text-[13px] text-[#a78bfa] mt-1">⟳ {pullProgress}</p>
          )}
          {pullStatus === 'done'  && <Status ok>Model ready</Status>}
          {pullStatus === 'error' && <Status>{pullProgress}</Status>}
        </Field>
      </Section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl font-semibold text-[16px] text-white
          bg-gradient-to-r from-[#7c5cfc] to-[#5a3fd4] shadow-lg
          disabled:opacity-50 transition-all"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}

/* ---------- Sub-components ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-5 space-y-4">
      <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">{title}</span>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[14px] text-[#e2e8f0] font-medium">{label}</label>
      {hint && <p className="text-[12px] text-[#b8b8d0]">{hint}</p>}
      {children}
    </div>
  )
}

function FormatToggle({ options, value, onChange }: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-4 py-1.5 rounded-lg text-[14px] border transition-all ${
            value === f
              ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.12)] text-[#c4b5fd]'
              : 'border-[#2e2e3e] text-[#aaaac8] hover:border-[#7c5cfc]'
          }`}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function ModelSelect({ value, options, onChange, disabled }: {
  value: string
  options: string[]
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full ${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <option value="">{disabled ? 'Scan models folder first' : 'Select a file…'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Status({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <p className={`text-[13px] mt-1 ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {ok ? '● ' : '● '}{children}
    </p>
  )
}

const inputCls = 'w-full bg-[#1a1a24] border border-[#2e2e3e] rounded-lg text-[#c4b5fd] text-[14px] px-3 py-2 outline-none focus:border-[#7c5cfc] transition-colors'
const secondaryBtn = 'flex-shrink-0 px-4 py-2 rounded-lg text-[14px] text-[#aaaac8] border border-[#2e2e3e] bg-[#1a1a24] hover:border-[#b8b8d0] transition-colors'
