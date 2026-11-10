"""Extractive composer: builds answers and insights from verbatim source sentences (no generation).

Used when no LLM is configured, as a fallback when the LLM is unavailable, and as a grounded baseline in
evaluation. Every sentence it emits is a quotation, so groundedness is 100% by construction.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np

from app.core.text import Span, analyze, idf_weights, sentence_spans, weighted_coverage, words
from app.i18n import t
from app.retrieval.embeddings import Embedder
from app.schemas.evidence import EvidenceChunk

_FINDING_CUES = re.compile(
    r"\b(reduc|lower|increas|higher|risk|associat|linked|protect|benefit|improv|recommend|evidence|"
    r"réduit|diminu|augment|risque|associ|protège|bénéfi|amélior|recommand|"
    r"reduc|disminu|aument|riesgo|asocia|protege|benefici|mejora|recomiend|"
    r"reduz|diminu|aument|risco|associad|protege|benefíci|melhora|recomend|"
    r"senk|verringer|erhöh|risiko|zusammenhang|schütz|nutzen|verbesser|empfehl)",
    re.IGNORECASE,
)
_RECOMMENDATION_CUES = re.compile(
    r"\b(recommend|should|aim for|at least|limit|avoid|choose|try to|it is best|"
    r"recommand|il est conseillé|devrait|au moins|limiter|éviter|privilégier|"
    r"recomienda|debería|al menos|limitar|evitar|"
    r"recomenda|deve|pelo menos|limitar|evitar|"
    r"empfohlen|empfiehlt|sollte|mindestens|begrenzen|vermeiden)",
    re.IGNORECASE,
)
_NOISE = re.compile(r"^(table|figure|fig\.|tableau|tabla|tabela|abbildung)\b|we searched|were recruited|"
                    r"funding|conflict of interest|copyright|all rights reserved|©", re.IGNORECASE)
_ANAPHORIC_START = re.compile(
    r"^(these|this|those|that|they|it|such|both|the latter|the former|ces|cette|ce|cela|ils|elles|celles?|ceux|"
    r"estos|estas|este|esta|esto|ellos|ellas|estes|estas|isso|isto|eles|elas|diese[rsnm]?|dies|sie|es)\b",
    re.IGNORECASE,
)
_GOOD_SECTIONS = re.compile(r"conclusion|result|finding|key|summary|recommend|abstract|résumé|résultat|"
                            r"conclusi|resultado|resumen|resumo|ergebnis|zusammenfassung|empfehl", re.IGNORECASE)


@dataclass(slots=True)
class Picked:
    chunk: EvidenceChunk
    span: Span
    score: float


class ExtractiveComposer:
    name = "extractive"

    def __init__(self, embedder: Embedder | None = None) -> None:
        self.embedder = embedder if embedder is not None and embedder.semantic else None

    def select(self, question: str, language: str, evidence: list[EvidenceChunk], *, max_sentences: int = 5,
               per_document: int = 2, prefer_recommendations: bool = False) -> list[Picked]:
        units = []
        relevance_floor = max((e.relevance for e in evidence), default=0.0) * 0.55
        for chunk in evidence:
            if chunk.relevance < relevance_floor:
                continue  # passage is about something else (shares only generic words with the question)
            for span in sentence_spans(chunk.text):
                n_words = len(words(span.text))
                if 7 <= n_words <= 70 and not _NOISE.search(span.text) and not _ANAPHORIC_START.match(span.text.lstrip("•-* ")):
                    units.append((chunk, span, set(analyze(span.text, chunk.source.language))))
        idf = idf_weights([terms for _, _, terms in units]) if len(units) >= 5 else {}
        candidates: list[Picked] = []
        for chunk, span, s_terms in units:
            q_terms = set(analyze(question, chunk.source.language))
            coverage = weighted_coverage(q_terms, s_terms, idf, chunk.source.language)
            section_bonus = 0.08 if chunk.section and _GOOD_SECTIONS.search(chunk.section) else 0.0
            cue = 0.1 if _FINDING_CUES.search(span.text) else 0.0
            rec = 0.12 if prefer_recommendations and _RECOMMENDATION_CUES.search(span.text) else 0.0
            score = (0.55 * coverage + 0.25 * chunk.relevance + 0.12 * chunk.source.quality_score
                     + cue + rec + section_bonus)
            candidates.append(Picked(chunk, span, score))
        if self.embedder is not None and candidates:
            q_vec = self.embedder.embed_query(question)
            s_vecs = self.embedder.embed_queries([c.span.text for c in candidates])
            sims = np.clip((s_vecs @ q_vec - 0.70) / 0.2, 0, 1)
            for c, sim in zip(candidates, sims, strict=True):
                c.score = 0.6 * c.score + 0.4 * float(sim)
        candidates.sort(key=lambda c: -c.score)
        if candidates:  # stay on topic: drop sentences far below the best match
            floor = candidates[0].score * 0.6
            candidates = [c for c in candidates if c.score >= floor]

        picked: list[Picked] = []
        per_doc: dict[str, int] = {}
        seen_terms: list[set[str]] = []
        for c in candidates:
            doc = c.chunk.source.document_id
            if per_doc.get(doc, 0) >= per_document:
                continue
            terms = set(analyze(c.span.text, c.chunk.source.language))
            if any(len(terms & s) / max(1, len(terms | s)) > 0.55 for s in seen_terms):
                continue  # near-duplicate statement from another source
            picked.append(c)
            seen_terms.append(terms)
            per_doc[doc] = per_doc.get(doc, 0) + 1
            if len(picked) >= max_sentences:
                break
        return picked

    def answer(self, question: str, language: str, evidence: list[EvidenceChunk]) -> str:
        picked = self.select(question, language, evidence)
        if not picked:
            return ""
        lines = [t("extractive_intro", language), ""]
        for p in picked:
            text = p.span.text.rstrip()
            lines.append(f"• {text} [{p.chunk.n}]")
        if any(p.chunk.source.language != language for p in picked):
            lines += ["", t("sources_other_language", language)]
        return "\n".join(lines)

    def insight(self, question: str, language: str, evidence: list[EvidenceChunk], title: str) -> dict:
        points = self.select(question, language, evidence, max_sentences=5)
        recs = [p for p in self.select(question, language, evidence, max_sentences=6, prefer_recommendations=True)
                if _RECOMMENDATION_CUES.search(p.span.text)][:3]
        rec_keys = {(p.chunk.n, p.span.start) for p in recs}
        points = [p for p in points if (p.chunk.n, p.span.start) not in rec_keys] or points
        summary = " ".join(f"{p.span.text} [{p.chunk.n}]" for p in points[:2])
        return {
            "title": title,
            "summary": summary,
            "key_points": [{"text": p.span.text, "citations": [p.chunk.n]} for p in points],
            "recommendations": [{"text": p.span.text, "citations": [p.chunk.n]} for p in recs],
            "limitations": [],
        }
