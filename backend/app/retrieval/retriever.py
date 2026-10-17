"""Hybrid evidence retrieval.

dense kNN ∥ BM25 sparse → reciprocal-rank fusion → rerank (calibrated relevance) → evidence-quality prior
→ MMR diversification with a per-document cap → numbered EvidenceChunks ready for citation.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np

from app.core.text import analyze, idf_weights, query_fillers, weighted_coverage
from app.evidence.grading import source_ref
from app.retrieval.embeddings import Embedder
from app.retrieval.reranker import Reranker
from app.retrieval.sparse import BM25Encoder, term_id
from app.retrieval.vectorstores.base import ScoredPoint, SearchFilters, VectorStore
from app.schemas.evidence import EvidenceChunk
from app.settings import Settings

log = logging.getLogger(__name__)


@dataclass(slots=True)
class Candidate:
    point: ScoredPoint
    dense: float = 0.0
    sparse: float = 0.0
    rrf: float = 0.0
    relevance: float = 0.0
    final: float = 0.0


@dataclass(slots=True)
class RetrievalResult:
    evidence: list[EvidenceChunk]
    best_relevance: float
    trace: dict = field(default_factory=dict)
    query_coverage: float = 0.0

    missing_share: float = 0.0  # share of the question's information absent from the whole corpus (lexical stacks)

    @property
    def answerability(self) -> float:
        """½ · best passage relevance + ½ · share of the question's information covered by the top passages,
        discounted when key question terms occur nowhere in the corpus."""
        return round((0.5 * self.best_relevance + 0.5 * self.query_coverage) * (1 - 0.6 * self.missing_share), 4)

    @property
    def sufficient(self) -> bool:
        return bool(self.evidence)


@dataclass(slots=True)
class Personalization:
    cancer_types: list[str] = field(default_factory=list)
    audience: str | None = None  # prevention | in_treatment | after_treatment | caregivers


class HybridRetriever:
    def __init__(self, settings: Settings, embedder: Embedder, sparse: BM25Encoder, store: VectorStore,
                 reranker: Reranker) -> None:
        self.settings = settings
        self.embedder = embedder
        self.sparse = sparse
        self.store = store
        self.reranker = reranker

    def retrieve(
        self,
        query: str,
        language: str,
        *,
        k: int | None = None,
        filters: SearchFilters | None = None,
        personalization: Personalization | None = None,
        extra_queries: list[str] | None = None,
        min_relevance: float | None = None,
    ) -> RetrievalResult:
        s = self.settings
        k = k or s.retrieval_top_k
        n_candidates = max(s.retrieval_candidates, k * 4)
        filters = filters or SearchFilters()
        threshold = s.retrieval_min_relevance if min_relevance is None else min_relevance
        t0 = time.perf_counter()

        queries = [query, *(extra_queries or [])]
        candidates: dict[str, Candidate] = {}
        for qi, q in enumerate(queries):
            q_weight = 1.0 if qi == 0 else 0.6
            dense_hits = self.store.search_dense(self.embedder.embed_query(q), n_candidates, filters)
            sparse_hits = self.store.search_sparse(self.sparse.encode_query(q, language), n_candidates, filters)
            for rank, hit in enumerate(dense_hits):
                c = candidates.setdefault(hit.id, Candidate(hit))
                c.dense = max(c.dense, hit.score)
                c.rrf += q_weight / (s.rrf_k + rank + 1)
            for rank, hit in enumerate(sparse_hits):
                c = candidates.setdefault(hit.id, Candidate(hit))
                c.sparse = max(c.sparse, hit.score)
                c.rrf += q_weight / (s.rrf_k + rank + 1)
        t_search = time.perf_counter()
        if not candidates:
            return RetrievalResult([], 0.0, {"candidates": 0, "ms": round((t_search - t0) * 1000, 1)})

        pool = sorted(candidates.values(), key=lambda c: -c.rrf)[: n_candidates]
        rerank_query = " ".join(queries[:2]) if len(queries) > 1 else query
        relevances = self.reranker.score(
            rerank_query, language,
            [(c.point.payload.get("text", ""), c.point.payload.get("language", "en")) for c in pool],
            [c.dense for c in pool],
        )
        max_rrf = max(c.rrf for c in pool) or 1.0
        boost_types = set(personalization.cancer_types) if personalization else set()
        for c, rel in zip(pool, relevances, strict=True):
            c.relevance = rel
            quality = float(c.point.payload.get("quality_score") or 0.2)
            fused = 0.8 * rel + 0.2 * (c.rrf / max_rrf)
            c.final = fused * (0.75 + 0.25 * quality)  # prefer stronger evidence when equally relevant
            if boost_types and boost_types & set(c.point.payload.get("cancer_types") or []):
                c.final *= 1.08
            if personalization and personalization.audience and \
                    personalization.audience in (c.point.payload.get("audience") or []):
                c.final *= 1.04
        pool = [c for c in pool if c.relevance >= threshold]
        pool.sort(key=lambda c: -c.final)
        best_relevance = max((c.relevance for c in pool), default=max(relevances, default=0.0))
        selected = self._mmr(pool, k, language)
        t_end = time.perf_counter()

        coverage = self._query_coverage(query, language, selected, best_relevance)
        evidence = []
        for n, c in enumerate(selected, start=1):
            p = c.point.payload
            evidence.append(EvidenceChunk(
                n=n, chunk_id=c.point.id, source=source_ref(p), text=p.get("text", ""), section=p.get("section"),
                page_start=p.get("page_start"), page_end=p.get("page_end"), relevance=c.relevance,
                score=round(c.final, 4),
            ))
        trace = {
            "candidates": len(candidates), "after_threshold": len(pool), "selected": len(evidence),
            "best_relevance": round(best_relevance, 4), "query_coverage": round(coverage, 4),
            "reranker": self.reranker.name,
            "embedder": self.embedder.name, "store": self.store.name,
            "ms": {"search": round((t_search - t0) * 1000, 1), "rerank_mmr": round((t_end - t_search) * 1000, 1)},
        }
        missing_share, missing = (0.0, []) if self.embedder.semantic else self._missing_terms(query, language, selected)
        trace["missing_terms"] = missing
        return RetrievalResult(evidence, best_relevance, trace, coverage, missing_share)

    def _missing_terms(self, query: str, language: str, selected: list[Candidate]) -> tuple[float, list[str]]:
        terms = {t for t in set(analyze(query, language)) - query_fillers(language) if len(t) >= 3}
        if not terms:
            return 0.0, []
        ids = {t: term_id(t) for t in terms}
        presence = self.store.term_presence(list(ids.values()))
        missing = sorted(t for t, i in ids.items() if not presence.get(i, True))
        if not missing:
            return 0.0, []
        idf = idf_weights([set(analyze(c.point.payload.get("text", ""), c.point.payload.get("language")))
                           for c in selected])
        unseen = max(idf.values(), default=1.0)
        total = sum(idf.get(t, unseen) for t in terms)
        return (sum(idf.get(t, unseen) for t in missing) / total if total else 0.0), missing

    @staticmethod
    def _query_coverage(query: str, language: str, selected: list[Candidate], best_relevance: float) -> float:
        top = sorted(selected, key=lambda c: -c.relevance)[:3]
        term_sets = [set(analyze(c.point.payload.get("text", ""), c.point.payload.get("language"))) for c in selected]
        same_lang = [c for c in top if c.point.payload.get("language") == language]
        if not same_lang:
            return best_relevance  # cross-lingual evidence: rely on the (semantic) relevance score
        union = set().union(*(set(analyze(c.point.payload.get("text", ""), language)) for c in same_lang))
        return weighted_coverage(set(analyze(query, language)), union, idf_weights(term_sets), language)

    def _mmr(self, pool: list[Candidate], k: int, language: str) -> list[Candidate]:
        if not pool:
            return []
        lam = self.settings.retrieval_mmr_lambda
        cap = self.settings.retrieval_max_chunks_per_document
        vectors = self.store.get_vectors([c.point.id for c in pool[: k * 5]])
        token_sets = {c.point.id: set(analyze(c.point.payload.get("text", ""), c.point.payload.get("language")))
                      for c in pool[: k * 5]}

        def similarity(a: Candidate, b: Candidate) -> float:
            va, vb = vectors.get(a.point.id), vectors.get(b.point.id)
            if va is not None and vb is not None:
                return float(np.dot(va, vb))
            ta, tb = token_sets.get(a.point.id, set()), token_sets.get(b.point.id, set())
            return len(ta & tb) / max(1, len(ta | tb))

        selected: list[Candidate] = []
        per_doc: dict[str, int] = {}
        remaining = list(pool[: k * 5])
        top = remaining[0].final or 1.0
        while remaining and len(selected) < k:
            best, best_score = None, -1e9
            for c in remaining:
                doc = c.point.payload.get("document_id", "")
                if per_doc.get(doc, 0) >= cap:
                    continue
                redundancy = max((similarity(c, s) for s in selected), default=0.0)
                score = lam * (c.final / top) - (1 - lam) * redundancy
                if score > best_score:
                    best, best_score = c, score
            if best is None:
                break
            selected.append(best)
            remaining.remove(best)
            doc = best.point.payload.get("document_id", "")
            per_doc[doc] = per_doc.get(doc, 0) + 1
        return selected
