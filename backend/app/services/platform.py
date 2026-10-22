"""Platform status, evidence search and the document library."""

from __future__ import annotations

import time
from collections import Counter

from sqlalchemy import func, select

from app.core.language import detect_language
from app.datasources.uri import parse_source_uri, redact_uri
from app.db.models import ChunkRow, DataSourceRow, DocumentRow, KeyValueRow
from app.evidence.grading import GradedSource, source_ref
from app.evidence.taxonomy import DESIGN, coerce_source_type
from app.schemas.api import (
    ChunkOut,
    DocumentDetail,
    DocumentList,
    DocumentSummary,
    PlatformStatus,
    SearchRequest,
    SearchResponse,
    SourceStatus,
)
from app.services.chat import filters_from


class PlatformService:
    def __init__(self, container) -> None:
        self.c = container
        self.settings = container.settings

    # ── status ───────────────────────────────────────────────────────────────
    def document_count(self) -> int:
        with self.c.db.session() as session:
            return int(session.scalar(select(func.count()).select_from(DocumentRow)
                                      .where(DocumentRow.status == "indexed")) or 0)

    def index_version(self) -> int:
        with self.c.db.session() as session:
            row = session.get(KeyValueRow, "index_version")
            return int(row.value.get("version", 0)) if row else 0

    def status(self, *, llm_available: bool | None = None) -> PlatformStatus:
        s = self.settings
        with self.c.db.session() as session:
            docs = int(session.scalar(select(func.count()).select_from(DocumentRow)
                                      .where(DocumentRow.status == "indexed")) or 0)
            chunks = int(session.scalar(select(func.count()).select_from(ChunkRow)) or 0)
            sources = list(session.scalars(select(DataSourceRow).order_by(DataSourceRow.created_at)))
            source_out = []
            for row in sources:
                try:
                    kind = parse_source_uri(row.uri, s.project_root).kind
                except ValueError:
                    kind = "invalid"
                source_out.append(SourceStatus(
                    id=row.id, name=row.name, kind=kind, uri=redact_uri(row.uri), enabled=row.enabled,
                    origin=row.origin, last_synced_at=row.last_synced_at, last_status=row.last_status,
                    last_error=row.last_error, documents=row.document_count,
                ))
        active = self.c.jobs.active()
        store_ok = self.c.store.health()
        if not store_ok:
            data_status = "degraded"
        elif docs > 0:
            data_status = "ready"
        elif active is not None and active.kind == "ingest":
            data_status = "indexing"
        else:
            data_status = "awaiting_data"
        llm = self.c.llm
        return PlatformStatus(
            app=s.app_name, version=s.version, environment=s.environment, data_status=data_status,  # type: ignore[arg-type]
            documents=docs, chunks=chunks, insights=self.c.insights.count_published(),
            index_version=self.index_version(), sources=source_out,
            llm={"provider": s.llm_provider, "model": llm.model if llm else "extractive",
                 "available": llm_available if llm else True, "grounding": "claim-level verification",
                 **({"canary": {"model": self.c.llm_canary.model, "percent": s.llm_canary_percent}}
                    if self.c.llm_canary else {})},
            embeddings={"provider": s.embedding_provider, "model": self.c.embedder.name, "dim": self.c.embedder.dim,
                        "multilingual": self.c.embedder.semantic},
            vector_store={"backend": self.c.store.name, "healthy": store_ok, "vectors": self.c.store.count()},
            languages=s.supported_languages,
            active_job={"id": active.id, "kind": active.kind, "status": active.status, "progress": active.progress,
                        "message": active.message} if active else None,
            admin_protected=s.admin_api_key is not None, sync_interval_seconds=s.sync_interval_seconds,
        )

    # ── search ───────────────────────────────────────────────────────────────
    def search(self, request: SearchRequest) -> SearchResponse:
        t0 = time.perf_counter()
        s = self.settings
        lang = (request.language or "")[:2]
        if lang not in s.supported_languages:
            lang = detect_language(request.query, s.supported_languages)
        result = self.c.retriever.retrieve(request.query, lang, k=request.top_k,
                                           filters=filters_from(request.filters, None))
        citations = self.c.verifier.citations_for(result.evidence, request.query, lang)
        assessment = self.c.grader.assess([GradedSource(e.source) for e in result.evidence], lang)
        return SearchResponse(query=request.query, language=lang, results=citations, evidence=assessment,
                              took_ms=round((time.perf_counter() - t0) * 1000, 1))

    # ── documents ────────────────────────────────────────────────────────────
    @staticmethod
    def _summary(row: DocumentRow) -> DocumentSummary:
        stype = coerce_source_type(row.source_type)
        return DocumentSummary(
            id=row.id, source_id=row.source_id, title=row.title, authors=row.authors[:12], year=row.year,
            journal=row.journal, publisher=row.publisher, doi=row.doi, pmid=row.pmid, url=row.url,
            language=row.language, source_type=row.source_type,
            source_type_label=DESIGN[stype].label if stype else row.source_type,
            source_type_basis=row.source_type_basis, source_type_confidence=row.source_type_confidence,
            credibility=row.credibility, quality_score=row.quality_score, n_chunks=row.n_chunks, status=row.status,
            retracted=row.retracted, license=row.license, indexed_at=row.indexed_at,
        )

    def documents(self, *, q: str | None = None, source_type: str | None = None, language: str | None = None,
                  status: str | None = "indexed", min_year: int | None = None, page: int = 1,
                  page_size: int = 25, sort: str = "quality") -> DocumentList:
        with self.c.db.session() as session:
            stmt = select(DocumentRow)
            if status:
                stmt = stmt.where(DocumentRow.status == status)
            base_rows = list(session.scalars(stmt))
        facets = {
            "source_type": dict(Counter(r.source_type for r in base_rows)),
            "language": dict(Counter(r.language for r in base_rows)),
            "credibility": dict(Counter(r.credibility for r in base_rows)),
        }
        rows = base_rows
        if source_type:
            rows = [r for r in rows if r.source_type == source_type]
        if language:
            rows = [r for r in rows if r.language == language]
        if min_year:
            rows = [r for r in rows if (r.year or 0) >= min_year]
        if q:
            needle = q.lower()
            rows = [r for r in rows if needle in f"{r.title} {' '.join(r.authors)} {r.journal or ''} "
                                                 f"{r.publisher or ''} {r.doi or ''}".lower()]
        key = {"quality": lambda r: (-r.quality_score, r.title), "year": lambda r: (-(r.year or 0), r.title),
               "title": lambda r: r.title.lower()}.get(sort, lambda r: (-r.quality_score, r.title))
        rows.sort(key=key)
        total = len(rows)
        start = (page - 1) * page_size
        return DocumentList(items=[self._summary(r) for r in rows[start: start + page_size]], total=total,
                            page=page, page_size=page_size, facets=facets)

    def document(self, doc_id: str, language: str | None = None) -> DocumentDetail | None:
        with self.c.db.session() as session:
            row = session.get(DocumentRow, doc_id)
            if row is None:
                return None
            chunks = [ChunkOut(id=c.id, ordinal=c.ordinal, text=c.text, section=c.section, page_start=c.page_start,
                               page_end=c.page_end) for c in row.chunks]
            summary = self._summary(row)
            payload = {"document_id": row.id, "title": row.title, "authors": row.authors, "year": row.year,
                       "journal": row.journal, "publisher": row.publisher, "doi": row.doi, "pmid": row.pmid,
                       "url": row.url, "source_type": row.source_type, "credibility": row.credibility,
                       "quality_score": row.quality_score, "language": row.language, "license": row.license}
            return DocumentDetail(
                **summary.model_dump(), abstract=row.abstract, topics=row.topics, cancer_types=row.cancer_types,
                error=row.error, chunks=chunks, cited_by=self.c.insights.cited_by(doc_id, language),
                source=source_ref(payload),
            )

    def chunk(self, chunk_id: str) -> tuple[ChunkOut, DocumentSummary] | None:
        with self.c.db.session() as session:
            row = session.get(ChunkRow, chunk_id)
            if row is None:
                return None
            return (ChunkOut(id=row.id, ordinal=row.ordinal, text=row.text, section=row.section,
                             page_start=row.page_start, page_end=row.page_end), self._summary(row.document))
