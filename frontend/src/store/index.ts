import { create } from 'zustand'
import type {
  AudioFile, AudioSegment, Character, Clip, ClipConfig,
  GlobalContext, SegmentationSettings,
} from '../types'
import { computeSegments } from '../lib/segments'

const DEFAULT_SEG_SETTINGS: SegmentationSettings = {
  min_duration: 4,
  max_duration: 8,         // capped at 10 (LTX 2.3 local limit)
  bias: 0.7,
  preset: 'varied_no_repeat',
}

interface AppState {
  audio: AudioFile | null
  segSettings: SegmentationSettings
  computedSegments: AudioSegment[]    // derived from audio + segSettings

  globalContext: GlobalContext
  characters: Character[]
  builderConfig: Partial<ClipConfig>
  queue: Clip[]

  // Actions
  setAudio: (audio: AudioFile | null) => void
  setSegSettings: (s: Partial<SegmentationSettings>) => void
  setGlobalContext: (ctx: Partial<GlobalContext>) => void
  setCharacters: (chars: Character[]) => void
  addCharacter: (char: Character) => void
  removeCharacter: (id: string) => void
  updateBuilder: (config: Partial<ClipConfig>) => void
  resetBuilder: () => void
  addToQueue: (clip: Clip) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  removeClip: (id: string) => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  audio: null,
  segSettings: DEFAULT_SEG_SETTINGS,
  computedSegments: [],

  globalContext: { style_theme: '', story_concept: '', locations: '' },
  characters: [],
  builderConfig: {},
  queue: [],

  setAudio: (audio) => {
    const segments = audio ? computeSegments(audio, get().segSettings) : []
    set({ audio, computedSegments: segments })
  },

  setSegSettings: (s) => {
    const next = { ...get().segSettings, ...s }
    // Enforce LTX 2.3 local max
    if (next.max_duration > 10) next.max_duration = 10
    if (next.min_duration < 1)  next.min_duration = 1
    if (next.min_duration >= next.max_duration) next.min_duration = next.max_duration - 1
    const audio = get().audio
    const segments = audio ? computeSegments(audio, next) : []
    set({ segSettings: next, computedSegments: segments })
  },

  setGlobalContext: (ctx) =>
    set((s) => ({ globalContext: { ...s.globalContext, ...ctx } })),
  setCharacters: (characters) => set({ characters }),
  addCharacter: (char) => set((s) => ({ characters: [...s.characters, char] })),
  removeCharacter: (id) => set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),

  updateBuilder: (config) =>
    set((s) => ({ builderConfig: { ...s.builderConfig, ...config } })),
  resetBuilder: () => set({ builderConfig: {} }),

  addToQueue: (clip) =>
    set((s) => ({ queue: [...s.queue, clip] })),
  updateClip: (id, updates) =>
    set((s) => ({
      queue: s.queue.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeClip: (id) =>
    set((s) => ({ queue: s.queue.filter((c) => c.id !== id) })),
  reorderQueue: (from, to) =>
    set((s) => {
      const q = [...s.queue]
      const [moved] = q.splice(from, 1)
      q.splice(to, 0, moved)
      return { queue: q }
    }),
}))
