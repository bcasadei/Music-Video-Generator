import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAppStore } from '../../store'
import { persistCharacter, removePersistedCharacter } from '../../lib/characters'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

export function CharacterPicker() {
  const characters = useAppStore((s) => s.characters)
  const builderConfig = useAppStore((s) => s.builderConfig)
  const updateBuilder = useAppStore((s) => s.updateBuilder)
  const addCharacter = useAppStore((s) => s.addCharacter)
  const removeCharacter = useAppStore((s) => s.removeCharacter)

  const [uploadFile, setUploadFile]       = useState<File | null>(null)
  const [uploadName, setUploadName]       = useState('')
  const [uploadTrigger, setUploadTrigger] = useState('')
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState<string | null>(null)

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setUploadFile(file)
    setUploadName(file.name.replace(/\.(safetensors|gguf)$/i, ''))
    setUploadTrigger('')
    setUploadError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.safetensors', '.gguf'] },
    multiple: false,
    noClick: !!uploadFile,
  })

  const handleSaveCharacter = async () => {
    if (!uploadFile || !uploadName || !uploadTrigger) return
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('lora_file', uploadFile)
      form.append('name', uploadName)
      form.append('trigger_word', uploadTrigger)
      const { data } = await axios.post('/api/characters/', form)
      const newChar = { id: data.id ?? uuidv4(), uploaded: true, ...data }
      persistCharacter(newChar)
      addCharacter(newChar)
      updateBuilder({ character: newChar, trigger_word: uploadTrigger })
      setUploadFile(null)
      setUploadName('')
      setUploadTrigger('')
    } catch {
      setUploadError('Upload failed — check the backend is running.')
    } finally {
      setUploading(false)
    }
  }

  const handleCancelUpload = () => {
    setUploadFile(null)
    setUploadName('')
    setUploadTrigger('')
    setUploadError(null)
  }

  return (
    <div className="bg-[#111118] border border-[#22222f] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold tracking-widest text-[#b8b8d0] uppercase">Character</span>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-[#b8b8d0]">Strength</span>
          <input
            type="range" min={0} max={100}
            value={(builderConfig.lora_strength ?? 0.75) * 100}
            onChange={(e) => updateBuilder({ lora_strength: Number(e.target.value) / 100 })}
            className="w-20 accent-[#7c5cfc]"
          />
          <span className="text-[14px] font-mono text-[#a78bfa]">
            {(builderConfig.lora_strength ?? 0.75).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Character grid */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {characters.map((char) => (
          <div
            key={char.id}
            onClick={() => updateBuilder({ character: char, trigger_word: char.trigger_word })}
            className={`rounded-lg p-1.5 cursor-pointer border transition-all relative group
              ${builderConfig.character?.id === char.id
                ? 'border-[#7c5cfc] shadow-[0_0_12px_rgba(124,92,252,0.2)]'
                : 'border-[#22222f] hover:border-[#7c5cfc] bg-[#1a1a24]'}`}
          >
            <img src={char.preview} alt={char.name} className="w-full aspect-square rounded-md object-cover" />
            <p className="text-[11px] text-[#aaaac8] mt-1 truncate">{char.name}</p>
            {char.uploaded && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removePersistedCharacter(char.id)
                  removeCharacter(char.id)
                  if (builderConfig.character?.id === char.id) updateBuilder({ character: undefined as any })
                }}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#0a0a0f] text-[#b8b8d0] text-[10px] leading-none hidden group-hover:flex items-center justify-center hover:text-red-400 hover:bg-[#1a1a24] transition-colors"
                title="Remove character"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Upload slot */}
        {!uploadFile ? (
          <div
            {...getRootProps()}
            className={`rounded-lg p-1.5 border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 bg-[#1a1a24] aspect-square transition-all
              ${isDragActive ? 'border-[#7c5cfc] bg-[rgba(124,92,252,0.05)]' : 'border-[#2e2e3e] hover:border-[#7c5cfc]'}`}
          >
            <input {...getInputProps()} />
            <span className="text-[#b8b8d0] text-lg leading-none">+</span>
            <span className="text-[11px] text-[#b8b8d0] text-center leading-tight">
              {isDragActive ? 'Drop' : 'Upload'}
            </span>
          </div>
        ) : (
          <div className="rounded-lg p-1.5 border border-[#7c5cfc] bg-[rgba(124,92,252,0.08)] aspect-square flex items-center justify-center">
            <span className="text-[11px] text-[#c4b5fd] text-center leading-tight truncate px-1">
              {uploadFile.name}
            </span>
          </div>
        )}
      </div>

      {/* Upload form — shown after a file is dropped */}
      {uploadFile && (
        <div className="border border-[#7c5cfc] bg-[rgba(124,92,252,0.05)] rounded-lg p-3 mb-3 space-y-2">
          <p className="text-[12px] font-semibold text-[#c4b5fd] uppercase tracking-wider">New Character</p>
          <input
            type="text"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="Character name"
            className="w-full bg-[#1a1a24] border border-[#2e2e3e] rounded-lg text-[#c4b5fd] text-[13px] px-3 py-1.5 outline-none focus:border-[#7c5cfc]"
          />
          <input
            type="text"
            value={uploadTrigger}
            onChange={(e) => setUploadTrigger(e.target.value)}
            placeholder="Trigger word (e.g. lyralook)"
            className="w-full bg-[#1a1a24] border border-[#2e2e3e] rounded-lg text-[#c4b5fd] text-[13px] px-3 py-1.5 outline-none focus:border-[#7c5cfc]"
          />
          {uploadError && <p className="text-[12px] text-red-400">{uploadError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSaveCharacter}
              disabled={!uploadName || !uploadTrigger || uploading}
              className="flex-1 py-1.5 rounded-lg text-[13px] font-medium text-white bg-gradient-to-r from-[#7c5cfc] to-[#5a3fd4] disabled:opacity-40"
            >
              {uploading ? 'Uploading…' : '+ Add Character'}
            </button>
            <button
              onClick={handleCancelUpload}
              className="px-3 py-1.5 rounded-lg text-[13px] text-[#b8b8d0] border border-[#2e2e3e] hover:border-[#b8b8d0]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Trigger word */}
      <div className="flex items-center gap-2">
        <span className="text-[14px] text-[#b8b8d0] whitespace-nowrap">Trigger</span>
        <input
          type="text"
          value={builderConfig.trigger_word ?? ''}
          onChange={(e) => updateBuilder({ trigger_word: e.target.value })}
          placeholder="e.g. lyralook"
          className="flex-1 bg-[#1a1a24] border border-[#22222f] rounded-lg text-[#c4b5fd] text-[14px] px-3 py-1.5 outline-none focus:border-[#7c5cfc]"
        />
      </div>
    </div>
  )
}
