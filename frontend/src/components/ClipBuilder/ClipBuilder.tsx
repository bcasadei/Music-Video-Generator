import { useState } from 'react'
import { useAppStore } from '../../store'
import { CharacterPicker } from '../CharacterPicker/CharacterPicker'
import axios from 'axios'
import type { Clip } from '../../types'
import { v4 as uuidv4 } from 'uuid'

export function ClipBuilder() {
  const { audio, builderConfig, updateBuilder, addToQueue, resetBuilder, globalContext } = useAppStore()
  const queue = useAppStore((s) => s.queue)
  const computedSegments = useAppStore((s) => s.computedSegments)
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const clipNumber = queue.length + 1

  const handleGenerate = async () => {
    if (!audio || !builderConfig.character || !builderConfig.segment) return
    setStatus('generating')
    setProgress(0)

    const jobId = uuidv4()
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/generate/ws/${jobId}`)
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.progress) setProgress(data.progress)
      if (data.clip_path) { setPreview(data.clip_path); setStatus('done') }
      if (data.error) setStatus('error')
    }

    await axios.post('/api/generate/clip', {
      file_id:          audio.file_id,
      segment_start:    builderConfig.segment.start,
      segment_end:      builderConfig.segment.end,
      segment_lyrics:   builderConfig.segment.text,
      lora_name:        builderConfig.character.lora_name,
      lora_strength:    builderConfig.lora_strength ?? 0.75,
      trigger_word:     builderConfig.trigger_word ?? builderConfig.character.trigger_word,
      style_preset:     builderConfig.style_preset ?? 'Custom',
      style_tags:       builderConfig.style_tags ?? [],
      resolution:       builderConfig.resolution ?? '1080p',
      fps:              builderConfig.fps ?? 24,
      transition:       builderConfig.transition ?? 'dissolve',
      global_context:   globalContext,
    })
  }

  const handleApprove = () => {
    if (!builderConfig.character || !builderConfig.segment || !preview) return
    const clip: Clip = {
      id: uuidv4(),
      ...(builderConfig as any),
      status: 'done',
      output_path: preview,
    }
    addToQueue(clip)
    resetBuilder()
    setStatus('idle')
    setPreview(null)
  }

  const handleReject = () => {
    setStatus('idle')
    setPreview(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">Clip Builder</span>
        <span className="text-[14px] px-2 py-0.5 rounded font-mono bg-[rgba(124,92,252,0.1)] text-[#7c5cfc] border border-[rgba(124,92,252,0.2)]">
          Clip {clipNumber}
        </span>
      </div>

      {/* Character */}
      <CharacterPicker />

      {/* Segment selector + Style */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-4">
          <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase block mb-3">Audio Segment</span>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {computedSegments.map((seg, i) => (
              <div
                key={i}
                onClick={() => updateBuilder({ segment: seg })}
                className={`p-2 rounded-lg cursor-pointer text-[14px] transition-all border
                  ${builderConfig.segment === seg
                    ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.08)] text-[#c4b5fd]'
                    : 'border-[#22222f] text-[#aaaac8] hover:border-[#b8b8d0]'}`}
              >
                <span className="font-mono text-[#b8b8d0] mr-2">
                  {seg.start.toFixed(0)}s–{seg.end.toFixed(0)}s
                </span>
                {seg.text}
              </div>
            ))}
          </div>
        </div>

        <StyleCard />
      </div>

      {/* Generate + Preview */}
      <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col justify-between">
            <p className="text-[14px] text-[#b8b8d0] leading-relaxed mb-4">
              Generate this clip to preview before adding to your queue. Tweak settings and regenerate as needed.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className="w-full py-2.5 rounded-lg font-semibold text-[16px] text-white flex items-center justify-center gap-2 bg-gradient-to-r from-[#7c5cfc] to-[#5a3fd4] shadow-lg disabled:opacity-50"
              >
                {status === 'generating' ? 'Generating…' : '▶ Generate Clip'}
              </button>

              {status === 'done' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleApprove}
                    className="py-2 rounded-lg text-[14px] font-medium text-[#4ade80] border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] hover:bg-[rgba(34,197,94,0.15)] transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={handleReject}
                    className="py-2 rounded-lg text-[14px] font-medium text-[#f87171] border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] hover:bg-[rgba(248,113,113,0.15)] transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={status === 'generating'}
                  className="w-full py-2 rounded-lg text-[14px] text-[#aaaac8] border border-[#2e2e3e] bg-[#1a1a24] hover:border-[#b8b8d0] disabled:opacity-30"
                >
                  ↺ Regenerate
                </button>
              )}
            </div>
          </div>

          {/* Preview area */}
          <div className="aspect-video bg-[#1a1a24] rounded-lg flex items-center justify-center relative overflow-hidden">
            {status === 'generating' && (
              <div className="text-center space-y-2">
                <div className="w-2 h-2 rounded-full bg-[#7c5cfc] animate-pulse mx-auto" />
                <p className="text-[14px] text-[#a78bfa]">Generating…</p>
                <div className="w-24 h-1 bg-[#2e2e3e] rounded-full mx-auto">
                  <div className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#a78bfa] rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {status === 'idle' && <span className="text-[14px] text-[#b8b8d0]">Preview appears here</span>}
            {status === 'done' && preview && (
              <video src={preview} controls className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Style tags card ---------- */

const SUGGESTIONS = [
  'cinematic', 'neon', 'cyberpunk', 'surreal', 'dreamlike', 'retro 80s',
  'film grain', 'volumetric fog', 'anamorphic', 'VHS glitch', 'pastel',
  'high contrast', 'shallow depth of field', 'moody lighting',
]

function StyleCard() {
  const builderConfig = useAppStore((s) => s.builderConfig)
  const updateBuilder = useAppStore((s) => s.updateBuilder)
  const [draft, setDraft] = useState('')

  const tags: string[] = builderConfig.style_tags ?? []

  const addTag = (raw: string) => {
    const cleaned = raw.trim().replace(/,$/, '').toLowerCase()
    if (!cleaned || tags.includes(cleaned)) return
    updateBuilder({ style_tags: [...tags, cleaned] } as any)
    setDraft('')
  }

  const removeTag = (t: string) => {
    updateBuilder({ style_tags: tags.filter((x) => x !== t) } as any)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(draft) }
    else if (e.key === 'Backspace' && !draft && tags.length) removeTag(tags[tags.length - 1])
  }

  return (
    <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-4 flex flex-col gap-3">
      <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">Style Tags</span>

      {/* Tag chips + input */}
      <div className="bg-[#1a1a24] border border-[#22222f] rounded-lg p-2 flex flex-wrap gap-1.5 min-h-[44px] focus-within:border-[#7c5cfc] transition-colors">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] bg-[rgba(124,92,252,0.12)] border border-[rgba(124,92,252,0.3)] text-[#c4b5fd]"
          >
            {t}
            <button
              onClick={() => removeTag(t)}
              className="text-[#a78bfa] hover:text-white transition-colors leading-none"
              aria-label={`remove ${t}`}
            >×</button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={tags.length ? '' : 'Type a tag and press Enter…'}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-[14px] text-[#c4b5fd] placeholder:text-[#b8b8d0]"
        />
      </div>

      {/* Quick-add suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.filter((s) => !tags.includes(s)).slice(0, 8).map((s) => (
          <button
            key={s}
            onClick={() => addTag(s)}
            className="text-[12px] px-2 py-0.5 rounded-md border border-[#22222f] text-[#b8b8d0] hover:border-[#7c5cfc] hover:text-[#c4b5fd] transition-all"
          >
            + {s}
          </button>
        ))}
      </div>

      {/* Resolution / FPS */}
      <div className="flex gap-3 mt-auto">
        {[['Res', ['1080p', '720p'], 'resolution'], ['FPS', ['24', '30'], 'fps']].map(([label, opts, key]) => (
          <div key={key as string} className="flex items-center gap-2">
            <span className="text-[14px] text-[#b8b8d0]">{label}</span>
            <select
              className="bg-[#1a1a24] border border-[#22222f] rounded-lg text-[#c4b5fd] text-[14px] px-2 py-1 outline-none"
              onChange={(e) => updateBuilder({ [key as string]: e.target.value } as any)}
            >
              {(opts as string[]).map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
