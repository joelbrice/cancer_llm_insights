"""
Translation Service.

Provides language detection and text translation using deep-translator
(supports 100+ languages via Google Translate API).
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def detect_language(text: str) -> str:
    """Detect the language of a text snippet. Returns ISO 639-1 code."""
    try:
        from langdetect import detect
        return detect(text)
    except Exception:
        return "en"


def translate_text(text: str, target_language: str, source_language: str = "auto") -> str:
    """
    Translate text to the target language.

    Falls back to the original text if translation fails or the language
    is the same as the source.
    """
    if target_language == source_language or target_language == "en":
        return text  # Skip round-trip; LLM already replies in English by default

    if target_language not in settings.SUPPORTED_LANGUAGES:
        logger.warning(
            "Language '%s' not in supported list — returning original text", target_language
        )
        return text

    try:
        from deep_translator import GoogleTranslator
        translated = GoogleTranslator(
            source=source_language if source_language != "auto" else "auto",
            target=target_language,
        ).translate(text[:4900])  # API limit guard
        return translated or text
    except Exception as exc:
        logger.warning("Translation failed (%s) — returning original text", exc)
        return text
