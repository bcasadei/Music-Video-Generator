import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAppStore } from '../../store'
import axios from 'axios'

const ACCEPTED = { 'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.webm'] }

type Stage = 'idle' | 'uploading' | 'transcribing' | 'done' | 'error'

export function AudioUpload() {
  const [stage, setStage] = useState<Stage>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const setAudio = useAppStore((s) => s.setAudio)
  const audio = useAppStore((s) => s.audio)

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setStage('uploading')
    setUploadProgress(0)
    setErrorMsg('')

    try {
      const form = new FormData()
      form.append('file', files[0])

      const { data } = await axios.post('/api/audio/upload', form, {
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        },
      })

      setStage('transcribing')
      setAudio(data)
      setStage('done')
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      const status = e?.response?.status
      const msg = detail
        ? (typeof detail === 'string' ? detail : JSON.stringify(detail))
        : e?.message ?? 'Upload failed'
      console.error('Upload error:', status, msg, e)
      setErrorMsg(`${status ? `[${status}] ` : ''}${msg}`)
      setStage('error')
    }
  }, [setAudio])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxFiles: 1,
    disabled: stage === 'uploading' || stage === 'transcribing',
  })

  const isProcessing = stage === 'uploading' || stage === 'transcribing'

  return (
    <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">Song</span>
        {stage === 'done' && audio && (
          <span className="text-[14px] font-mono text-[#b8b8d0]">
            {audio.filename} · BPM: {audio.bpm}
          </span>
        )}
      </div>

      {stage === 'done' && audio ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-10 bg-[#1a1a24] rounded-lg" />
            <button
              className="text-[14px] px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-[#aaaac8] hover:border-[#b8b8d0]"
              onClick={() => { useAppStore.getState().setAudio(null); setStage('idle') }}
            >
              Change
            </button>
          </div>
          <SegmentSettingsPanel />
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all
            ${isProcessing ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.05)] cursor-default'
              : stage === 'error' ? 'border-red-500/40 cursor-pointer'
              : isDragActive ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.05)] cursor-pointer'
              : 'border-[#2e2e3e] hover:border-[#7c5cfc] cursor-pointer'}`}
        >
          <input {...getInputProps()} />

          {/* Icon */}
          <div className="flex justify-center mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke={stage === 'error' ? '#f87171' : isProcessing ? '#7c5cfc' : '#b8b8d0'}
              strokeWidth="1.5">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>

          {/* Label */}
          <p className={`text-[16px] mb-1 ${stage === 'error' ? 'text-red-400' : 'text-[#aaaac8]'}`}>
            {stage === 'idle'         && 'Drop audio here or click to upload'}
            {stage === 'uploading'    && 'Uploading…'}
            {stage === 'transcribing' && 'Transcribing lyrics…'}
            {stage === 'error'        && errorMsg}
          </p>
          {stage === 'idle' && (
            <p className="text-[14px] text-[#b8b8d0]">MP3, WAV, FLAC, M4A, OGG, WEBM</p>
          )}

          {/* Progress section */}
          {isProcessing && (
            <div className="mt-5 space-y-3">

              {/* Step indicators */}
              <div className="flex items-center justify-center gap-3">
                {(['uploading', 'transcribing'] as Stage[]).map((s, i) => {
                  const isActive = stage === s
                  const isDone   = stage === 'transcribing' && s === 'uploading'
                  return (
                    <div key={s} className="flex items-center gap-2">
                      {i > 0 && <div className={`w-6 h-px ${isDone ? 'bg-[#7c5cfc]' : 'bg-[#2e2e3e]'}`} />}
                      <div className={`w-2 h-2 rounded-full transition-all ${
                        isDone ? 'bg-[#7c5cfc]' : isActive ? 'bg-[#7c5cfc] animate-pulse' : 'bg-[#2e2e3e]'
                      }`} />
                      <span className={`text-[13px] ${isActive || isDone ? 'text-[#c4b5fd]' : 'text-[#b8b8d0]'}`}>
                        {s === 'uploading' ? 'Upload' : 'Transcribe'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
                {stage === 'uploading' ? (
                  <div
                    className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#a78bfa] rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                ) : (
                  <div className="h-full w-full relative overflow-hidden bg-[#2e2e3e] rounded-full">
                    <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#7c5cfc] to-transparent"
                      style={{ animation: 'shimmer 1.4s ease-in-out infinite' }} />
                  </div>
                )}
              </div>

              {stage === 'uploading' && (
                <p className="text-[13px] font-mono text-[#7c5cfc]">{uploadProgress}%</p>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}

/* ---------- Segmentation settings panel ---------- */

const PRESET_OPTIONS: { value: 'varied_no_repeat' | 'impact_weighted' | 'clustered_no_repeat'; label: string; help: string }[] = [
  { value: 'varied_no_repeat',   label: 'Varied (no repeat)', help: 'Avoids similar scene lengths back-to-back' },
  { value: 'impact_weighted',    label: 'Impact weighted',    help: 'Follows strongest beats' },
  { value: 'clustered_no_repeat', label: 'Clustered',         help: 'Keeps lengths similar but still varied' },
]

function SegmentSettingsPanel() {
  const segSettings    = useAppStore((s) => s.segSettings)
  const setSegSettings = useAppStore((s) => s.setSegSettings)
  const computedCount  = useAppStore((s) => s.computedSegments.length)

  return (
    <div className="bg-[#0a0a0f] border border-[#22222f] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">
          Scene Segmentation
        </span>
        <span className="text-[13px] font-mono text-[#a78bfa]">
          {computedCount} clip{computedCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Min duration */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-[#b8b8d0]">Min duration</span>
            <span className="text-[13px] font-mono text-[#c4b5fd]">{segSettings.min_duration}s</span>
          </div>
          <input
            type="range" min={1} max={9} step={0.5}
            value={segSettings.min_duration}
            onChange={(e) => setSegSettings({ min_duration: Number(e.target.value) })}
            className="w-full accent-[#7c5cfc]"
          />
        </div>

        {/* Max duration */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-[#b8b8d0]">Max duration <span className="text-[11px] text-[#7c5cfc]">(LTX cap: 10s)</span></span>
            <span className="text-[13px] font-mono text-[#c4b5fd]">{segSettings.max_duration}s</span>
          </div>
          <input
            type="range" min={2} max={10} step={0.5}
            value={segSettings.max_duration}
            onChange={(e) => setSegSettings({ max_duration: Number(e.target.value) })}
            className="w-full accent-[#7c5cfc]"
          />
        </div>

        {/* Beat snap bias */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-[#b8b8d0]">Beat snap</span>
            <span className="text-[13px] font-mono text-[#c4b5fd]">{segSettings.bias.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05}
            value={segSettings.bias}
            onChange={(e) => setSegSettings({ bias: Number(e.target.value) })}
            className="w-full accent-[#7c5cfc]"
          />
          <p className="text-[11px] text-[#9090b0] mt-1 leading-snug">
            Higher = cuts snap harder to beats
          </p>
        </div>

        {/* Preset */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] text-[#b8b8d0]">Duration preset</span>
          </div>
          <select
            value={segSettings.preset}
            onChange={(e) => setSegSettings({ preset: e.target.value as any })}
            className="w-full bg-[#1a1a24] border border-[#22222f] rounded-lg text-[#c4b5fd] text-[14px] px-2 py-1.5 outline-none focus:border-[#7c5cfc]"
          >
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-[#9090b0] mt-1 leading-snug">
            {PRESET_OPTIONS.find((o) => o.value === segSettings.preset)?.help}
          </p>
        </div>
      </div>
    </div>
  )
}
