"""
Audio Analysis Service.

Transcribes audio (speech-to-text via OpenAI Whisper) and extracts
symptom and lifestyle information for the LLM analysis pipeline.
"""

from __future__ import annotations

import io
import logging
import tempfile
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_AUDIO_FORMATS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4"}


def _get_whisper_model():
    """Lazy-load Whisper model to avoid startup delays."""
    try:
        import whisper
        model = whisper.load_model(settings.WHISPER_MODEL)
        logger.info("Whisper model '%s' loaded", settings.WHISPER_MODEL)
        return model
    except Exception as exc:
        logger.warning("Whisper not available: %s — using mock transcription", exc)
        return None


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str,
    language: Optional[str] = None,
) -> dict:
    """
    Transcribe audio file and return a dict with `text` and `language`.

    Parameters
    ----------
    audio_bytes: Raw audio file bytes.
    filename: Original filename (used to validate format).
    language: Hint language code (ISO 639-1) for better accuracy.
    """
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_AUDIO_FORMATS:
        raise ValueError(
            f"Unsupported audio format '{suffix}'. "
            f"Supported: {', '.join(SUPPORTED_AUDIO_FORMATS)}"
        )

    size_mb = len(audio_bytes) / (1024 * 1024)
    if size_mb > settings.MAX_AUDIO_SIZE_MB:
        raise ValueError(
            f"Audio file too large ({size_mb:.1f} MB). "
            f"Maximum allowed: {settings.MAX_AUDIO_SIZE_MB} MB"
        )

    model = _get_whisper_model()

    if model is None:
        # Mock transcription for demo / CI environments
        logger.warning("Using mock transcription (Whisper not available)")
        return {
            "text": (
                "I have been experiencing fatigue and some weight loss recently. "
                "I smoke occasionally and my diet is not very good. "
                "I would like to know my cancer risk."
            ),
            "language": language or "en",
        }

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        kwargs = {"task": "transcribe"}
        if language and language != "auto":
            kwargs["language"] = language

        result = model.transcribe(tmp_path, **kwargs)
        return {
            "text": result["text"].strip(),
            "language": result.get("language", language or "en"),
        }
    finally:
        import os
        os.unlink(tmp_path)
