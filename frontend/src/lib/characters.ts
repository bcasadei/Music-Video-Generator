import type { Character } from '../types'

const STORAGE_KEY = 'musicvid_uploaded_characters'

export function getUploadedCharacters(): Character[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function persistCharacter(char: Character): void {
  const existing = getUploadedCharacters()
  if (existing.find((c) => c.id === char.id)) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, char]))
}

export function removePersistedCharacter(id: string): void {
  const existing = getUploadedCharacters()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter((c) => c.id !== id)))
}
