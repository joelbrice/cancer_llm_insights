"""Second-stage relevance scoring producing calibrated scores in [0, 1] (used for abstention)."""

from __future__ import annotations

import logging
import math
from abc import ABC, abstractmethod

from app.core.text import analyze, idf_weights, weighted_coverage
from app.settings import Settings

log = logging.getLogger(__name__)


class Reranker(ABC):
    name: str

    @abstractmethod
    def score(self, query: str, query_lang: str, passages: list[tuple[str, str]], dense: list[float]) -> list[float]:
        """passages: (text, language). dense: first-stage cosine for each passage. Returns relevance ∈ [0, 1]."""


class LexicalReranker(Reranker):
    """Query-term coverage (stemmed, same language) blended with first-stage dense similarity."""

    name = "lexical"

    def __init__(self, semantic_embedder: bool) -> None:
        self.semantic = semantic_embedder

    def score(self, query: str, query_lang: str, passages: list[tuple[str, str]], dense: list[float]) -> list[float]:
        out = []
        passage_terms = [set(analyze(text, lang)) for text, lang in passages]
        idf = idf_weights(passage_terms) if len(passage_terms) >= 5 else {}
        for (_text, lang), p_terms, cos in zip(passages, passage_terms, dense, strict=True):
            q_terms = set(analyze(query, lang))
            coverage = weighted_coverage(q_terms, p_terms, idf) if lang == query_lang and q_terms else 0.0
            if self.semantic:  # neural cosine is informative (and cross-lingual)
                dense_rel = min(1.0, max(0.0, (cos - 0.70) / 0.20))
                rel = max(dense_rel, 0.55 * coverage + 0.45 * dense_rel)
            else:  # hashing cosine is lexical: blend
                rel = 0.7 * coverage + 0.3 * min(1.0, max(0.0, cos) * 1.6)
            out.append(round(rel, 4))
        return out


class CrossEncoderReranker(Reranker):
    name = "cross_encoder"

    def __init__(self, model: str) -> None:
        from sentence_transformers import CrossEncoder

        self.model = CrossEncoder(model, max_length=512)
        self.name = f"cross_encoder:{model}"

    def score(self, query: str, query_lang: str, passages: list[tuple[str, str]], dense: list[float]) -> list[float]:
        if not passages:
            return []
        raw = self.model.predict([(query, text) for text, _ in passages], show_progress_bar=False)
        return [round(1 / (1 + math.exp(-float(x))), 4) if not 0 <= float(x) <= 1 else round(float(x), 4) for x in raw]


class NoReranker(Reranker):
    name = "none"

    def score(self, query: str, query_lang: str, passages: list[tuple[str, str]], dense: list[float]) -> list[float]:
        return [round(max(0.0, min(1.0, c)), 4) for c in dense]


def build_reranker(settings: Settings, semantic_embedder: bool) -> Reranker:
    if settings.reranker_provider == "cross_encoder":
        try:
            return CrossEncoderReranker(settings.reranker_model)
        except Exception as exc:  # pragma: no cover - optional dependency
            log.warning("cross-encoder reranker unavailable (%s) — using lexical reranker", exc)
    if settings.reranker_provider == "none":
        return NoReranker()
    return LexicalReranker(semantic_embedder)
