from faster_whisper import WhisperModel
import asyncio

_model = None


def _get_model():
    global _model
    if _model is None:
        # Runs on CPU by default; set device="cuda" if you want GPU transcription
        _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


async def transcribe_audio(audio_path: str) -> list[dict]:
    """
    Transcribe audio and return timed lyric segments.
    Returns: [{start, end, text}, ...]
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe_sync, audio_path)


def _transcribe_sync(audio_path: str) -> list[dict]:
    model = _get_model()
    segments, _ = model.transcribe(audio_path, beam_size=5)
    return [
        {"start": round(seg.start, 2), "end": round(seg.end, 2), "text": seg.text.strip()}
        for seg in segments
    ]
