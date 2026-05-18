import { useState } from 'react'
import { useAppStore } from '../../store'
import axios from 'axios'
import type { Clip } from '../../types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

export function ClipQueue() {
  const { queue, removeClip, reorderQueue, audio } = useAppStore()
  const [assembling, setAssembling] = useState(false)
  const [outputPath, setOutputPath] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  const totalDuration = queue.reduce((acc, c) => {
    if (c.segment) return acc + (c.segment.end - c.segment.start)
    return acc
  }, 0)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = queue.findIndex((c) => c.id === active.id)
    const to = queue.findIndex((c) => c.id === over.id)
    if (from !== -1 && to !== -1) reorderQueue(from, to)
  }

  const handleAssemble = async () => {
    if (!audio || queue.length === 0) return
    setAssembling(true)
    const { data } = await axios.post('/api/generate/assemble', {
      clip_paths: queue.map((c) => c.output_path),
      audio_path: audio.path,
      transition: queue[0]?.transition ?? 'dissolve',
      output_filename: `musicvid_${Date.now()}.mp4`,
    })
    setOutputPath(data.output_path)
    setAssembling(false)
  }

  if (queue.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">Clip Queue</span>
          <span className="text-[14px] px-2 py-0.5 rounded bg-[#1a1a24] text-[#b8b8d0] border border-[#2e2e3e]">
            {queue.length} clip{queue.length !== 1 ? 's' : ''} · {Math.round(totalDuration)}s
          </span>
        </div>
        <button
          onClick={handleAssemble}
          disabled={assembling}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-[16px] text-white
            bg-gradient-to-r from-[#059669] to-[#047857] shadow-[0_4px_20px_rgba(5,150,105,0.3)]
            disabled:opacity-50 transition-all hover:shadow-[0_6px_28px_rgba(5,150,105,0.5)]"
        >
          {assembling ? '⏳ Assembling…' : '↓ Assemble MP4'}
        </button>
      </div>

      <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-4 space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={queue.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {queue.map((clip, i) => (
              <SortableClipRow
                key={clip.id}
                clip={clip}
                index={i}
                onRemove={() => removeClip(clip.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-[#22222f]" />
          <span className="text-[14px] text-[#b8b8d0]">scroll up to build next clip</span>
          <div className="flex-1 h-px bg-[#22222f]" />
        </div>
      </div>

      {outputPath && (
        <div className="mt-4 p-4 bg-[#111118] border border-[rgba(34,197,94,0.3)] rounded-xl flex items-center justify-between">
          <span className="text-[16px] text-[#4ade80]">✓ Video ready</span>
          <a
            href={`/api/download?path=${outputPath}`}
            className="text-[14px] px-4 py-2 rounded-lg bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] text-[#4ade80] hover:bg-[rgba(34,197,94,0.2)]"
          >
            ↓ Download MP4
          </a>
        </div>
      )}
    </div>
  )
}

/* ---------- Sortable row ---------- */

function SortableClipRow({ clip, index, onRemove }: { clip: Clip; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-3 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[#1a1a24]"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-[#2e2e3e] hover:text-[#b8b8d0] cursor-grab active:cursor-grabbing select-none text-lg transition-colors"
        title="Drag to reorder"
      >
        ⠿
      </span>

      <div className="w-28 aspect-video rounded-md bg-[#0a0a0f] flex-shrink-0 overflow-hidden">
        {clip.output_path && (
          <video src={clip.output_path} className="w-full h-full object-cover" muted />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[16px] font-medium text-[#e2e8f0]">Clip {index + 1}</span>
          <span className="text-[12px] px-1.5 py-0.5 rounded bg-[rgba(34,197,94,0.1)] text-[#4ade80] border border-[rgba(34,197,94,0.2)]">
            Approved
          </span>
          {clip.style_preset && clip.style_preset !== 'Custom' && (
            <span className="text-[12px] px-1.5 py-0.5 rounded bg-[rgba(124,92,252,0.1)] text-[#c4b5fd] border border-[rgba(124,92,252,0.2)]">
              {clip.style_preset}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[14px] text-[#b8b8d0]">
          {clip.character && <span>{clip.character.name}</span>}
          {clip.segment && (
            <span>{clip.segment.start.toFixed(0)}s – {clip.segment.end.toFixed(0)}s</span>
          )}
          <span>{clip.resolution} · {clip.fps}fps</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="text-[14px] px-3 py-1.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-[#aaaac8] hover:border-[#b8b8d0]">
          Edit
        </button>
        <button
          onClick={onRemove}
          className="text-[#b8b8d0] hover:text-red-400 transition-colors p-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
