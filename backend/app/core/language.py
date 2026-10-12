"""Lightweight, dependency-free language identification for the supported languages.

Scores stopword hits plus language-specific character/word cues. It is fast (µs), deterministic and
accurate enough for routing (answer language, stemmer choice). A `hint` (UI language) breaks ties and
is used for very short inputs.
"""

from __future__ import annotations

import re
from collections import Counter

from app.core.text import STOPWORDS, words

_CUES: dict[str, tuple[re.Pattern[str], float]] = {
    "fr": (re.compile(r"[àâçèêëîïôœùûÿ]|\b(?:l'|d'|qu'|c'est|j'ai|n'est|est-ce)", re.I), 1.5),
    "es": (re.compile(r"[ñ¿¡]|ción\b|\b(?:qué|cómo|cuál|dónde|está|también)\b", re.I), 1.8),
    "pt": (re.compile(r"[ãõ]|ção\b|ções\b|\b(?:não|você|também|está|são)\b", re.I), 1.8),
    "de": (re.compile(r"[äöüß]|\b(?:und|nicht|ist|ich|wie|das|der|die)\b", re.I), 1.2),
    "en": (re.compile(r"\b(?:the|and|is|what|how|does|should|can|my|of)\b", re.I), 0.6),
    "it": (re.compile(r"zion[ei]\b|\b(?:perché|più|può|cioè|gli|della|delle|degli|nella|nelle|questo|questa|sono|anche"
                      r"|rischio|rischi|tumore|tumori|chemio|chemioterapia|mangiare|fumare|bere|dottore|grazie|ciao)\b",
                      re.I), 1.5),
}

# Languages added after 1.0 score only on function words that are unmistakably theirs (never used in English,
# French, Spanish, Portuguese or German text), so adding them cannot change how those texts are identified.
# Arabic is recognised by its script (_SCRIPTS).
_DISTINCT_STOP: dict[str, frozenset[str]] = {
    "it": frozenset({
        "della", "delle", "degli", "dello", "nella", "nelle", "negli", "sulla", "sulle", "dalla", "dalle", "alla",
        "alle", "gli", "sono", "che", "anche", "più", "perché", "questo", "questa", "questi", "queste", "quello",
        "quella", "abbiamo", "hanno", "molto", "essere", "avere", "stato", "cioè", "può", "possono",
    }) - frozenset().union(*STOPWORDS.values()),
}

_SCRIPTS = [
    ("ar", re.compile(r"[؀-ۿ]")),
    ("zh", re.compile(r"[一-鿿]")),
    ("ja", re.compile(r"[぀-ヿ]")),
    ("ko", re.compile(r"[가-힯]")),
    ("ru", re.compile(r"[Ѐ-ӿ]")),
    ("hi", re.compile(r"[ऀ-ॿ]")),
]


def detect_language(text: str, supported: list[str] | None = None, hint: str | None = None) -> str:
    supported = supported or list(STOPWORDS)
    sample = text[:4000]
    for code, pattern in _SCRIPTS:
        if len(pattern.findall(sample)) > max(3, len(sample) * 0.2):
            return code if code in supported else (hint or supported[0])

    tokens = [w.lower() for w in words(sample)]
    if not tokens:
        return hint if hint in supported else supported[0]

    scores: Counter[str] = Counter()
    for lang in supported:
        stop = STOPWORDS.get(lang) or _DISTINCT_STOP.get(lang)
        if stop:
            scores[lang] += sum(1.0 for t in tokens if t in stop)
        cue = _CUES.get(lang)
        if cue:
            scores[lang] += len(cue[0].findall(sample)) * cue[1]
    if hint in supported:
        scores[hint] += 0.75  # prefer the UI language on ties / short inputs

    if not scores or max(scores.values()) <= 0.75:
        return hint if hint in supported else supported[0]
    best, best_score = scores.most_common(1)[0]
    if len(tokens) <= 3 and hint in supported and scores[hint] >= best_score - 1:
        return hint  # too little signal: trust the user's chosen UI language
    return best
