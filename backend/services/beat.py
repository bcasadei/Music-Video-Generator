import librosa
import asyncio


async def detect_beats(audio_path: str) -> dict:
    """
    Detect BPM and beat timestamps from audio file.
    Returns: {bpm, beats: [timestamp, ...]}
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _detect_sync, audio_path)


def _detect_sync(audio_path: str) -> dict:
    y, sr = librosa.load(audio_path, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    # tempo may be a 0-d or 1-d array depending on librosa version
    bpm = float(tempo.item() if hasattr(tempo, 'item') else tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    return {"bpm": round(bpm, 1), "beats": beat_times}
