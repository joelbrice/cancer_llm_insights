"""Claim-level grounding verification.

For every sentence of a generated answer we find the passage sentences that best support it and score
support in [0, 1]:
  * lexical  — stemmed content-term and bigram coverage (same language)
  * semantic — embedding cosine, calibrated (neural embedders only; enables cross-lingual checks)
  * NLI      — optional multilingual entailment model (VERIFIER_PROVIDER=nli)
Statistics in a claim that do not appear in the cited passage are flagged (`number_not_in_source`),
and null/contradicting findings across sources mark the evidence as "mixed".
"""

from __future__ import annotations

import bisect
import itertools
import logging
import re
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.language import detect_language
from app.core.text import Span, analyze, extract_numbers, sentence_spans, words
from app.i18n import MESSAGES
from app.retrieval.embeddings import Embedder
from app.schemas.evidence import Citation, ClaimCheck, EvidenceChunk, Verification
from app.settings import Settings

log = logging.getLogger(__name__)

CITATION_MARK = re.compile(r"\s?\[(\d+(?:\s*[,;–-]\s*\d+)*)\]")
_ADVICE = re.compile(
    r"(talk|speak|discuss|consult|check) (with|to)? ?(your|a) (doctor|care team|oncologist|nurse|gp|dietitian|"
    r"healthcare)|parlez|consultez|discutez|hable con|consulte|fale com|converse com|sprechen sie|"
    r"wenden sie sich|educational information|information éducative|información educativa|informação educativa|"
    r"bildungsinformation",
    re.IGNORECASE,
)
_NULL_FINDING = re.compile(
    r"\bno (significant |clear |consistent )?(association|effect|difference|evidence|benefit|link)|"
    r"not (significantly )?(associated|linked|related)|did not (reduce|increase|change|improve|find|show)|"
    r"was not (associated|linked)|\binconclusive\b|"
    r"pas d'association|aucune association|aucun (effet|lien)|n'est pas associ|"
    r"sin asociación|no se asoci|ningún efecto|sem associação|não (foi |esteve )?associad|nenhum efeito|"
    r"kein(en)? (signifikanten )?(zusammenhang|effekt)|nicht assoziiert",
    re.IGNORECASE,
)


def parse_citations(sentence: str, n_max: int) -> list[int]:
    found: list[int] = []
    for group in CITATION_MARK.findall(sentence):
        for part in re.split(r"\s*[,;]\s*", group):
            if re.fullmatch(r"\d+\s*[–-]\s*\d+", part):
                a, b = (int(x) for x in re.split(r"\s*[–-]\s*", part))
                rng = range(min(a, b), min(max(a, b), min(a, b) + 10) + 1)
                found.extend(rng)
            elif part.strip().isdigit():
                found.append(int(part))
    return [n for n in dict.fromkeys(found) if 1 <= n <= n_max]


def strip_citations(text: str) -> str:
    return CITATION_MARK.sub("", text).strip()


def _norm(text: str) -> str:
    return re.sub(r"[^\w ]+", "", text.lower()).strip()


_BOILERPLATE = {_norm(MESSAGES[k][lang]) for k in ("extractive_intro", "sources_other_language", "next_step",
                                                    "disclaimer", "abstain", "awaiting_data")
                for lang in MESSAGES[k]}
_BOILERPLATE_PREFIXES = tuple(_norm(v.split("{")[0]) for v in MESSAGES["evidence_strength"].values())


def is_factual_claim(sentence: str) -> bool:
    clean = strip_citations(sentence).strip(" •-*#")
    if clean.endswith(("?", ":")) or len(words(clean)) < 5:
        return False
    normalized = _norm(clean)
    if normalized in _BOILERPLATE or normalized.startswith(_BOILERPLATE_PREFIXES):
        return False
    return not _ADVICE.search(clean)


@dataclass(slots=True)
class _Window:
    start: int
    end: int
    text: str
    terms: set[str]
    bigrams: set[tuple[str, str]]


def _bigrams(terms: list[str]) -> set[tuple[str, str]]:
    return set(itertools.pairwise(terms))


class ClaimVerifier:
    def __init__(self, settings: Settings, embedder: Embedder | None = None) -> None:
        self.settings = settings
        self.embedder = embedder if embedder is not None and embedder.semantic else None
        self._nli: Any = None
        if settings.verifier_provider == "nli":
            try:
                from sentence_transformers import CrossEncoder

                self._nli = CrossEncoder(settings.verifier_model, max_length=512)
                self.method = "nli"
            except Exception as exc:  # pragma: no cover - optional dependency
                log.warning("NLI verifier unavailable (%s) — falling back to lexical/semantic", exc)
        self.method = "nli" if self._nli else ("semantic+lexical" if self.embedder else "lexical")

    # ── windows over a passage ──────────────────────────────────────────────
    def _windows(self, passage: str, language: str) -> list[_Window]:
        spans: list[Span] = sentence_spans(passage) or [Span(0, len(passage), passage)]
        analyzed = [analyze(s.text, language) for s in spans]
        windows = [_Window(s.start, s.end, s.text, set(a), _bigrams(a)) for s, a in zip(spans, analyzed, strict=True)]
        for i in range(len(spans) - 1):
            a = analyzed[i] + analyzed[i + 1]
            windows.append(_Window(spans[i].start, spans[i + 1].end, passage[spans[i].start: spans[i + 1].end],
                                   set(a), _bigrams(a)))
        return windows

    @staticmethod
    def _lexical(claim_terms: list[str], window: _Window) -> float:
        if not claim_terms:
            return 0.0
        unique = set(claim_terms)
        coverage = len(unique & window.terms) / len(unique)
        bigrams = _bigrams(claim_terms)
        bigram_cov = len(bigrams & window.bigrams) / len(bigrams) if bigrams else coverage
        pair_penalty = 0.95 if window.text.count(". ") >= 1 and len(window.text) > 260 else 1.0
        return (0.75 * coverage + 0.25 * bigram_cov) * pair_penalty

    def _semantic(self, claim_vec: np.ndarray | None, window_vecs: np.ndarray | None) -> np.ndarray | None:
        if claim_vec is None or window_vecs is None or not len(window_vecs):
            return None
        cos = window_vecs @ claim_vec
        lo, hi = self.settings.semantic_support_floor, self.settings.semantic_support_ceiling
        return np.clip((cos - lo) / max(1e-6, hi - lo), 0.0, 1.0)

    def _label(self, support: float | None, issues: list[str]) -> str:
        if support is None:
            return "not_assessed"
        if "number_not_in_source" in issues:
            return "unsupported"  # an invented statistic is never acceptable in health information
        if support >= self.settings.support_threshold:
            return "supported"
        if support >= self.settings.partial_support_threshold:
            return "partial"
        return "unsupported"

    # ── main entry point ────────────────────────────────────────────────────
    def verify(self, answer: str, evidence: list[EvidenceChunk], language: str) -> tuple[Verification, list[Citation], str]:
        by_n = {e.n: e for e in evidence}
        windows = {e.n: self._windows(e.text, e.source.language) for e in evidence}
        sentences = [s for s in sentence_spans(answer)]
        claims_meta = []
        for s in sentences:
            claims_meta.append((s, parse_citations(s.text, max(by_n) if by_n else 0), is_factual_claim(s.text)))

        claim_vecs: dict[int, np.ndarray] = {}
        window_vecs: dict[int, np.ndarray] = {}
        if self.embedder is not None and evidence:
            texts = [strip_citations(s.text) for s, _, factual in claims_meta if factual]
            idx = [i for i, (_, _, factual) in enumerate(claims_meta) if factual]
            if texts:
                vecs = self.embedder.embed_queries(texts)
                claim_vecs = dict(zip(idx, vecs, strict=True))
            flat = [(n, w.text) for n, ws in windows.items() for w in ws]
            if flat:
                all_vecs = self.embedder.embed_queries([t for _, t in flat])
                cursor = 0
                for n, ws in windows.items():
                    window_vecs[n] = all_vecs[cursor: cursor + len(ws)]
                    cursor += len(ws)

        best_quote: dict[int, tuple[float, _Window]] = {}
        checks: list[ClaimCheck] = []
        null_by_claim: list[tuple[set[int], set[int]]] = []
        for i, (span, cited, factual) in enumerate(claims_meta):
            check = ClaimCheck(sentence=span.text, start=span.start, end=span.end, citations=cited)
            if not factual:
                check.label = "not_claim"
                checks.append(check)
                continue
            claim_text = strip_citations(span.text)
            claim_lang = detect_language(claim_text, self.settings.supported_languages, hint=language)
            claim_numbers = extract_numbers(claim_text)
            candidates = cited or list(by_n)
            best: tuple[float | None, int | None] = (None, None)
            null_sources, positive_sources = set(), set()
            for n in candidates:
                chunk = by_n[n]
                same_lang = chunk.source.language == claim_lang  # quotes may stay in the source language
                claim_terms = analyze(claim_text, chunk.source.language if same_lang else claim_lang)
                lex = np.array([self._lexical(claim_terms, w) for w in windows[n]]) if same_lang else None
                sem = self._semantic(claim_vecs.get(i), window_vecs.get(n))
                if lex is not None and sem is not None:
                    scores = 0.5 * lex + 0.5 * sem
                elif lex is not None:
                    scores = lex
                elif sem is not None:
                    scores = sem
                else:
                    continue
                if self._nli is not None:
                    scores = self._nli_scores(claim_text, windows[n], scores)
                j = int(np.argmax(scores))
                score = float(scores[j])
                if n in cited and (n not in best_quote or score > best_quote[n][0]):
                    best_quote[n] = (score, windows[n][j])
                if best[0] is None or score > best[0]:
                    best = (score, n)
                if score >= self.settings.partial_support_threshold:
                    (null_sources if _NULL_FINDING.search(windows[n][j].text) else positive_sources).add(n)
            support, best_n = best
            if claim_numbers and cited:
                cited_numbers = set().union(*(extract_numbers(by_n[n].text) for n in cited))
                if not claim_numbers <= cited_numbers:
                    check.issues.append("number_not_in_source")
            check.support = None if support is None else round(support, 3)
            check.best_citation = best_n
            if not cited:
                check.label = "no_citation"
                check.issues.append("missing_citation")
            else:
                check.label = self._label(support, check.issues)  # type: ignore[assignment]
            if cited:
                null_by_claim.append((null_sources, positive_sources))
            checks.append(check)

        factual = [c for c in checks if c.label not in ("not_claim",)]
        assessed = [c for c in factual if c.label != "not_assessed"]
        supported = [c for c in assessed if c.label == "supported"]
        cited_total = sum(len(c.citations) for c in factual)
        good_citations = sum(len(c.citations) for c in factual if c.label in ("supported", "partial"))
        verification = Verification(
            claims=checks,
            grounded_ratio=round(len(supported) / len(assessed), 3) if assessed else 0.0,
            citation_precision=round(good_citations / cited_total, 3) if cited_total else 0.0,
            unsupported=sum(1 for c in factual if c.label in ("unsupported", "no_citation")),
            method=self.method,
        )

        cited_ns = sorted({n for c in checks for n in c.citations})
        citations = [self._citation(by_n[n], best_quote.get(n)) for n in cited_ns]
        n_sources = len({by_n[n].source.document_id for n in cited_ns})
        if n_sources < 2:
            consistency = "not_assessed"
        elif any(nulls and positives for nulls, positives in null_by_claim):
            consistency = "mixed"
        else:
            consistency = "consistent"
        return verification, citations, consistency

    def verify_points(self, points: list[tuple[str, list[int]]], evidence: list[EvidenceChunk], language: str
                      ) -> tuple[list[tuple[float | None, str]], Verification, list[Citation], str]:
        """Verify structured points (insight key points/recommendations). Each sentence of a point inherits the
        point's citations; a point is `supported` only if all of its factual sentences are."""
        lines, owners = [], []
        for idx, (text, cites) in enumerate(points):
            marker = "".join(f"[{n}]" for n in cites)
            clean = strip_citations(text)
            for span in sentence_spans(clean) or [Span(0, len(clean), clean)]:
                lines.append(f"{span.text} {marker}".strip())
                owners.append(idx)
        answer = "\n".join(lines)
        verification, citations, consistency = self.verify(answer, evidence, language)
        starts, cursor = [], 0
        for line in lines:
            starts.append(cursor)
            cursor += len(line) + 1
        per_point: list[list[ClaimCheck]] = [[] for _ in points]
        for claim in verification.claims:
            line_idx = max(0, bisect.bisect_right(starts, claim.start) - 1)
            per_point[owners[line_idx]].append(claim)
        results: list[tuple[float | None, str]] = []
        for claims in per_point:
            factual = [c for c in claims if c.label != "not_claim"]
            if not factual:
                results.append((None, "not_claim"))
                continue
            labels = {c.label for c in factual}
            supports = [c.support for c in factual if c.support is not None]
            support = round(sum(supports) / len(supports), 3) if supports else None
            if labels <= {"supported"}:
                label = "supported"
            elif labels <= {"unsupported", "no_citation"}:
                label = "unsupported"
            elif labels <= {"not_assessed"}:
                label = "not_assessed"
            else:
                label = "partial"
            results.append((support, label))
        return results, verification, citations, consistency

    def citations_for(self, evidence: list[EvidenceChunk], query: str, language: str) -> list[Citation]:
        """Citations for evidence shown without a generated claim (e.g. search results): quote = best match."""
        out = []
        for chunk in evidence:
            ws = self._windows(chunk.text, chunk.source.language)
            terms = analyze(query, chunk.source.language)
            scores = [self._lexical(terms, w) for w in ws]
            j = int(np.argmax(scores)) if scores else 0
            out.append(self._citation(chunk, (float(scores[j]) if scores else 0.0, ws[j]) if ws else None,
                                      assess=False))
        return out

    def _citation(self, chunk: EvidenceChunk, best: tuple[float, _Window] | None, assess: bool = True) -> Citation:
        if best is None:
            spans = sentence_spans(chunk.text)
            first = spans[0] if spans else Span(0, len(chunk.text), chunk.text)
            quote, start, end, support = first.text, first.start, first.end, None
        else:
            support, window = best
            quote, start, end = window.text, window.start, window.end
        label = "not_assessed"
        if assess and support is not None:
            label = "strong" if support >= self.settings.support_threshold else (
                "partial" if support >= self.settings.partial_support_threshold else "weak")
        return Citation(
            n=chunk.n, chunk_id=chunk.chunk_id, source=chunk.source, quote=quote, quote_start=start, quote_end=end,
            passage=chunk.text, section=chunk.section, page_start=chunk.page_start, page_end=chunk.page_end,
            relevance=chunk.relevance, support=None if (support is None or not assess) else round(support, 3),
            support_label=label,  # type: ignore[arg-type]
        )

    def _nli_scores(self, claim: str, windows: list[_Window], base: np.ndarray) -> np.ndarray:
        pairs = [(w.text, claim) for w in windows]
        logits = np.asarray(self._nli.predict(pairs, apply_softmax=True))
        labels = [label.lower() for label in getattr(self._nli.model.config, "id2label", {}).values()]
        entail_idx = labels.index("entailment") if "entailment" in labels else 0
        return 0.6 * logits[:, entail_idx] + 0.4 * base
