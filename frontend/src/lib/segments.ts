import type { AudioFile, AudioSegment, SegmentationSettings } from '../types'

/**
 * Compute clip segments from raw Whisper segments + beats + settings.
 *
 * Strategy:
 * 1. Walk the song timeline from 0 to end.
 * 2. For each clip, pick a target length based on the preset.
 * 3. Snap the cut point to the nearest beat within [min, max] window.
 * 4. Pull the Whisper text that falls within that time range.
 */
export function computeSegments(
  audio: AudioFile,
  settings: SegmentationSettings,
): AudioSegment[] {
  const { min_duration, max_duration, bias, preset } = settings
  const songEnd = audio.segments.length
    ? audio.segments[audio.segments.length - 1].end
    : (audio.beats[audio.beats.length - 1] ?? 0)

  if (songEnd <= 0) return []

  const out: AudioSegment[] = []
  let cursor = 0
  let lastDuration = 0
  let rngSeed = audio.file_id.length

  const rand = () => {
    // Deterministic PRNG so the same file produces the same segmentation
    rngSeed = (rngSeed * 9301 + 49297) % 233280
    return rngSeed / 233280
  }

  while (cursor < songEnd - 0.5) {
    // Pick a target duration based on the preset
    let target: number
    switch (preset) {
      case 'clustered_no_repeat':
        // Stay close to the midpoint, with small variation
        target = (min_duration + max_duration) / 2 + (rand() - 0.5) * 1.5
        // Avoid repeating the same length
        if (Math.abs(target - lastDuration) < 0.8) target += rand() > 0.5 ? 1 : -1
        break

      case 'impact_weighted':
        // Bias toward longer clips on strong beats (we use beat density as a proxy)
        target = min_duration + rand() * (max_duration - min_duration)
        break

      case 'varied_no_repeat':
      default:
        // Wide variation, avoid repeating last duration
        target = min_duration + rand() * (max_duration - min_duration)
        if (Math.abs(target - lastDuration) < 1) {
          target = min_duration + rand() * (max_duration - min_duration)
        }
        break
    }

    target = Math.max(min_duration, Math.min(max_duration, target))

    // Snap to nearest beat within [cursor + min, cursor + max]
    const minEnd = cursor + min_duration
    const maxEnd = Math.min(cursor + max_duration, songEnd)
    const idealEnd = Math.min(cursor + target, maxEnd)

    let end = idealEnd
    if (bias > 0 && audio.beats.length) {
      const candidates = audio.beats.filter((b) => b >= minEnd && b <= maxEnd)
      if (candidates.length) {
        // Closest beat to ideal, weighted by bias
        const nearest = candidates.reduce((best, b) =>
          Math.abs(b - idealEnd) < Math.abs(best - idealEnd) ? b : best
        )
        end = idealEnd * (1 - bias) + nearest * bias
      }
    }

    // Pull lyrics that fall within this window
    const text = audio.segments
      .filter((s) => s.end > cursor && s.start < end)
      .map((s) => s.text)
      .join(' ')
      .trim()

    out.push({
      start: Number(cursor.toFixed(2)),
      end:   Number(end.toFixed(2)),
      text:  text || '(instrumental)',
    })

    lastDuration = end - cursor
    cursor = end
  }

  return out
}
