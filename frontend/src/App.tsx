import { useState, useEffect } from 'react'
import { useAppStore } from './store'
import { AudioUpload } from './components/AudioUpload/AudioUpload'
import { ClipBuilder } from './components/ClipBuilder/ClipBuilder'
import { ClipQueue } from './components/ClipQueue/ClipQueue'
import { Settings } from './components/Settings/Settings'
import { getUploadedCharacters } from './lib/characters'
import axios from 'axios'

type View = 'main' | 'settings'

export default function App() {
  const setCharacters = useAppStore((s) => s.setCharacters)
  const audio = useAppStore((s) => s.audio)
  const [view, setView] = useState<View>('main')

  useEffect(() => {
    const uploaded = getUploadedCharacters()
    axios.get('/api/characters/')
      .then((r) => setCharacters([...r.data, ...uploaded]))
      .catch(() => { if (uploaded.length) setCharacters(uploaded) })
  }, [setCharacters])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a24]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#7c5cfc] to-[#5a3fd4]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <button
            onClick={() => setView('main')}
            className="font-semibold text-sm tracking-wide hover:text-white transition-colors"
          >
            MusicVid
          </button>
          <span className="text-xs px-2 py-0.5 rounded bg-[#1a1a24] text-[#4a4a6a] border border-[#2e2e3e]">v0.1</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[14px] text-[#b8b8d0]">
            ComfyUI <span className="text-green-500">●</span> Connected
          </span>
          <button
            onClick={() => setView(view === 'settings' ? 'main' : 'settings')}
            className={`p-2 rounded-lg border transition-all ${
              view === 'settings'
                ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.12)] text-[#c4b5fd]'
                : 'border-[#2e2e3e] text-[#b8b8d0] hover:border-[#7c5cfc] hover:text-[#c4b5fd]'
            }`}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {view === 'settings' ? (
          <Settings />
        ) : (
          <>
            <AudioUpload />
            {audio && (
              <>
                <ClipBuilder />
                <ClipQueue />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
