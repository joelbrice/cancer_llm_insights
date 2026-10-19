"""Incremental ingestion: scan sources → load → enrich → classify → chunk → embed → index.

* Change detection by file fingerprint (etag/mtime/size + sidecar/manifest), so re-syncs are cheap.
* Deleted files and removed sources are purged from the DB and the vector index.
* Exact duplicates (same normalised text) are recorded but indexed once.
* Each file is committed independently: a corrupt file never blocks the rest of the corpus.
"""

from __future__ import annotations

import hashlib
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, func, select

from app.core.language import detect_language
from app.core.text import content_fingerprint, slugify
from app.datasources.registry import SourceRegistry, SourceSpec
from app.datasources.scanner import RemoteFile, SourceScanner
from app.db.base import Database
from app.db.models import ChunkRow, DataSourceRow, DocumentRow, KeyValueRow
from app.evidence.grading import document_quality
from app.ingestion.chunker import chunk_blocks
from app.ingestion.classify import classify
from app.ingestion.loaders import LoadedDocument, LoaderError, load_bytes
from app.ingestion.metadata import CredibilityRegistry, extract_from_text, guess_title, normalize_metadata
from app.retrieval.embeddings import Embedder
from app.retrieval.sparse import BM25Encoder
from app.retrieval.vectorstores.base import VectorRecord, VectorStore
from app.settings import Settings

log = logging.getLogger(__name__)
Progress = Callable[[float, str], None]


@dataclass(slots=True)
class IngestStats:
    sources: int = 0
    files_seen: int = 0
    files_unchanged: int = 0
    documents_added: int = 0
    documents_updated: int = 0
    documents_removed: int = 0
    documents_failed: int = 0
    duplicates: int = 0
    chunks_indexed: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)
    source_errors: dict[str, str] = field(default_factory=dict)
    seconds: float = 0.0

    @property
    def changed(self) -> bool:
        return bool(self.documents_added or self.documents_updated or self.documents_removed)

    def as_dict(self) -> dict[str, Any]:
        out = {k: getattr(self, k) for k in self.__slots__}  # type: ignore[attr-defined]
        out["errors"] = self.errors[:50]
        out["changed"] = self.changed
        return out


def _base_path(path: str) -> str:
    return path.split("#", 1)[0]


# Identifiers are dropped rather than cut when they do not fit (a truncated DOI or URL points somewhere else).
_DROP_IF_TOO_LONG = frozenset({"doi", "pmid", "pmcid", "url", "published_date"})


def fit_columns(row: DocumentRow) -> None:
    """Make every text value fit its column. SQLite ignores VARCHAR lengths but PostgreSQL rejects the whole row,
    which would silently drop the document from the library."""
    for column in DocumentRow.__table__.columns:
        limit = getattr(column.type, "length", None)
        value = getattr(row, column.key, None)
        if limit and isinstance(value, str) and len(value) > limit:
            log.warning("document %s: %s longer than %d characters, %s", row.id, column.key, limit,
                        "dropped" if column.key in _DROP_IF_TOO_LONG else "shortened")
            setattr(row, column.key, None if column.key in _DROP_IF_TOO_LONG else value[:limit])


def document_id(source_id: str, path: str) -> str:
    return "d_" + hashlib.sha1(f"{source_id}\x00{path}".encode(), usedforsecurity=False).hexdigest()[:22]


class IngestionService:
    def __init__(self, settings: Settings, db: Database, registry: SourceRegistry, scanner: SourceScanner,
                 embedder: Embedder, sparse: BM25Encoder, store: VectorStore,
                 credibility: CredibilityRegistry | None = None) -> None:
        self.settings = settings
        self.db = db
        self.registry = registry
        self.scanner = scanner
        self.embedder = embedder
        self.sparse = sparse
        self.store = store
        self.credibility = credibility or CredibilityRegistry()

    # ── public API ───────────────────────────────────────────────────────────
    def sync(self, source_ids: list[str] | None = None, mode: str = "incremental",
             progress: Progress | None = None, should_cancel: Callable[[], bool] | None = None) -> IngestStats:
        started = time.perf_counter()
        progress = progress or (lambda _f, _m: None)
        should_cancel = should_cancel or (lambda: False)
        stats = IngestStats()
        self.store.ensure(self.embedder.dim)
        specs = [s for s in self.registry.sync_config() if s.enabled and (not source_ids or s.id in source_ids)]
        stats.sources = len(specs)
        stats.documents_removed += self._purge_orphans({s.id for s in self.registry.list()})

        for index, spec in enumerate(specs):
            base, span = index / max(1, len(specs)), 1 / max(1, len(specs))
            progress(base, f"Scanning {spec.name}")
            try:
                files = list(self.scanner.scan(spec))
            except Exception as exc:
                message = f"{type(exc).__name__}: {exc}"
                log.error("source %s unreachable: %s", spec.id, message)
                stats.source_errors[spec.id] = message
                self._update_source(spec.id, status="unreachable", error=message)
                continue
            stats.files_seen += len(files)
            existing = self._existing(spec.id)
            seen_bases: set[str] = set()
            for n, file in enumerate(files):
                if should_cancel():
                    raise InterruptedError("ingestion cancelled")
                seen_bases.add(file.path)
                prior = existing.get(file.path, [])
                if mode != "full" and prior and all(d[1] == file.fingerprint for d in prior):
                    stats.files_unchanged += 1
                    continue
                progress(base + span * (n / max(1, len(files))), f"{spec.name}: {file.path}")
                self._process_file(spec, file, prior, stats)
            removed = [p for p in existing if p not in seen_bases]
            for path in removed:
                stats.documents_removed += self._delete_documents([d[0] for d in existing[path]])
            self._update_source(spec.id, status="ok" if spec.id not in stats.source_errors else "error")

        self.store.persist()
        if stats.changed:
            self._bump_index_version()
        stats.seconds = round(time.perf_counter() - started, 2)
        progress(1.0, "Done")
        log.info("ingestion finished: %s", {k: v for k, v in stats.as_dict().items() if k != "errors"})
        return stats

    def reset(self) -> None:
        self.store.reset()
        with self.db.session() as session:
            session.execute(delete(ChunkRow))
            session.execute(delete(DocumentRow))
        self._bump_index_version()

    # ── internals ────────────────────────────────────────────────────────────
    def _existing(self, source_id: str) -> dict[str, list[tuple[str, str]]]:
        out: dict[str, list[tuple[str, str]]] = {}
        with self.db.session() as session:
            rows = session.execute(select(DocumentRow.id, DocumentRow.path, DocumentRow.file_fingerprint)
                                   .where(DocumentRow.source_id == source_id))
            for doc_id, path, fingerprint in rows:
                out.setdefault(_base_path(path), []).append((doc_id, fingerprint))
        return out

    def _purge_orphans(self, live_sources: set[str]) -> int:
        with self.db.session() as session:
            ids = [r for (r,) in session.execute(select(DocumentRow.id).where(DocumentRow.source_id.not_in(live_sources)))]
        return self._delete_documents(ids) if ids else 0

    def _delete_documents(self, ids: list[str]) -> int:
        if not ids:
            return 0
        self.store.delete_documents(ids)
        with self.db.session() as session:
            session.execute(delete(ChunkRow).where(ChunkRow.document_id.in_(ids)))
            result = session.execute(delete(DocumentRow).where(DocumentRow.id.in_(ids)))
        return int(result.rowcount or 0)

    def _process_file(self, spec: SourceSpec, file: RemoteFile, prior: list[tuple[str, str]],
                      stats: IngestStats) -> None:
        try:
            data = self.scanner.read_bytes(spec, file)
            loaded = load_bytes(data, file.path, file.extension)
        except (LoaderError, OSError, ValueError) as exc:
            stats.documents_failed += 1
            stats.errors.append({"source": spec.id, "path": file.path, "error": str(exc)})
            self._record_failure(spec, file, str(exc))
            return
        except Exception as exc:  # unexpected parser failure: isolate it
            log.exception("failed to load %s", file.path)
            stats.documents_failed += 1
            stats.errors.append({"source": spec.id, "path": file.path, "error": f"{type(exc).__name__}: {exc}"})
            self._record_failure(spec, file, f"{type(exc).__name__}: {exc}")
            return

        produced: set[str] = set()
        prior_ids = {d[0] for d in prior}
        for doc in loaded:
            path = file.path if doc.record_key is None else f"{file.path}#{slugify(str(doc.record_key), 120)}"
            try:
                doc_id, n_chunks, duplicate = self._index_document(spec, file, path, doc)
            except Exception as exc:
                log.exception("failed to index %s", path)
                stats.documents_failed += 1
                stats.errors.append({"source": spec.id, "path": path, "error": f"{type(exc).__name__}: {exc}"})
                continue
            produced.add(doc_id)
            stats.chunks_indexed += n_chunks
            stats.duplicates += int(duplicate)
            if doc_id in prior_ids:
                stats.documents_updated += 1
            else:
                stats.documents_added += 1
        stale = [i for i in prior_ids if i not in produced]
        stats.documents_removed += self._delete_documents(stale)

    def _record_failure(self, spec: SourceSpec, file: RemoteFile, error: str) -> None:
        doc_id = document_id(spec.id, file.path)
        with self.db.session() as session:
            row = session.get(DocumentRow, doc_id) or DocumentRow(id=doc_id, source_id=spec.id, path=file.path)
            row.uri, row.file_fingerprint, row.content_hash = file.location, file.fingerprint, ""
            row.title = row.title or file.path.rsplit("/", 1)[-1]
            row.status, row.error, row.n_chunks = "failed", error[:2000], 0
            fit_columns(row)
            session.merge(row)
        self.store.delete_documents([doc_id])

    def _resolve_metadata(self, spec: SourceSpec, file: RemoteFile, doc: LoadedDocument, text: str) -> dict[str, Any]:
        defaults = {k: v for k, v in spec.defaults.items() if k not in ("source_type", "credibility")}
        merged: dict[str, Any] = dict(defaults)
        merged.update(extract_from_text(text))
        if doc.record_key is None:
            merged.update(doc.metadata)
            merged.update(file.metadata)
        else:
            merged.update(file.metadata)
            merged.update(doc.metadata)
        meta = normalize_metadata(merged)
        if "year" not in meta:
            for key in ("_pdf_year", "_doc_year"):
                if doc.metadata.get(key):
                    meta["year"] = int(doc.metadata[key])
                    break
        return meta

    def _index_document(self, spec: SourceSpec, file: RemoteFile, path: str,
                        doc: LoadedDocument) -> tuple[str, int, bool]:
        doc_text, chunks = chunk_blocks(doc.blocks, self.settings.chunk_size_tokens, self.settings.chunk_overlap_tokens)
        meta = self._resolve_metadata(spec, file, doc, doc_text)
        language = meta.get("language") or detect_language(doc_text, [*self.settings.supported_languages, "it", "nl"])
        title = str(meta.get("title") or guess_title(doc_text, path))[:1000]
        url = meta.get("url")
        cred = meta.get("credibility")
        reg_cred, reg_publisher = self.credibility.lookup(url, meta.get("publisher"), meta.get("journal"))
        credibility = cred or (reg_cred.value if reg_cred else None) or spec.defaults.get("credibility") or "unverified"
        classification = classify(title=title, text=doc_text, metadata=meta, hints=doc.hints,
                                  source_default=spec.defaults.get("source_type"))
        source_type = classification.source_type.value
        quality = document_quality(source_type, credibility, meta.get("year"))
        content_hash = content_fingerprint(doc_text) if doc_text else ""
        doc_id = document_id(spec.id, path)

        with self.db.session() as session:
            duplicate_of = session.scalar(
                select(DocumentRow.id).where(DocumentRow.content_hash == content_hash, DocumentRow.id != doc_id,
                                             DocumentRow.status == "indexed").limit(1)
            ) if content_hash else None
            row = session.get(DocumentRow, doc_id) or DocumentRow(id=doc_id, source_id=spec.id, path=path)
            row.uri = file.location if not file.inline_text else f"{file.location}#{path}"
            row.file_fingerprint, row.content_hash = file.fingerprint, content_hash
            row.title, row.authors = title, list(meta.get("authors") or [])[:50]
            row.year, row.published_date = meta.get("year"), meta.get("published_date")
            row.journal, row.publisher = meta.get("journal"), meta.get("publisher") or reg_publisher
            row.doi, row.pmid, row.pmcid, row.url = meta.get("doi"), meta.get("pmid"), meta.get("pmcid"), url
            row.language, row.source_type = language, source_type
            row.source_type_confidence, row.source_type_basis = classification.confidence, classification.basis
            row.credibility, row.quality_score = credibility, quality
            row.topics = list(meta.get("topics") or [])
            row.cancer_types = list(meta.get("cancer_types") or [])
            row.audience = list(meta.get("audience") or [])
            row.license, row.retracted = meta.get("license"), bool(meta.get("retracted", False))
            row.sample_size, row.extra = meta.get("sample_size"), dict(meta.get("extra") or {})
            row.abstract = next((b.text for b in doc.blocks if (b.section or "").lower().startswith("abstract")), None)
            row.n_chars, row.error, row.indexed_at = len(doc_text), None, datetime.now(UTC)
            row.duplicate_of = duplicate_of
            if row.retracted:
                row.status, row.n_chunks = "retracted", 0  # kept for transparency, never retrievable
            elif duplicate_of:
                row.status, row.n_chunks = "duplicate", 0
            elif not chunks:
                row.status, row.n_chunks, row.error = "failed", 0, "no indexable text"
            else:
                row.status, row.n_chunks = "indexed", len(chunks)
            fit_columns(row)
            session.merge(row)
            session.execute(delete(ChunkRow).where(ChunkRow.document_id == doc_id))
            if row.status == "indexed":
                session.add_all([
                    ChunkRow(id=f"{doc_id}:{c.ordinal}", document_id=doc_id, ordinal=c.ordinal, text=c.text,
                             section=(c.section or None) and c.section[:500], page_start=c.page_start,
                             page_end=c.page_end, char_start=c.char_start, char_end=c.char_end,
                             token_count=c.token_count, language=language, content_hash=c.content_hash)
                    for c in chunks
                ])
            status = row.status

        self.store.delete_documents([doc_id])
        if status != "indexed":
            return doc_id, 0, status == "duplicate"

        headers = [f"{title}. {c.section}." if c.section else f"{title}." for c in chunks]
        vectors = self.embedder.embed_documents([f"{h} {c.text}" for h, c in zip(headers, chunks, strict=True)])
        base_payload = {
            "document_id": doc_id, "source_id": spec.id, "title": title, "authors": row.authors[:6],
            "year": row.year, "journal": row.journal, "publisher": row.publisher, "doi": row.doi, "pmid": row.pmid,
            "url": url, "language": language, "source_type": source_type, "credibility": credibility,
            "quality_score": quality, "topics": row.topics, "cancer_types": row.cancer_types,
            "audience": row.audience, "retracted": row.retracted, "license": row.license,
        }
        records = [
            VectorRecord(
                id=f"{doc_id}:{c.ordinal}", vector=vectors[i],
                sparse=self.sparse.encode_document(f"{headers[i]} {c.text}", language),
                payload={**base_payload, "text": c.text, "section": c.section, "page_start": c.page_start,
                         "page_end": c.page_end, "ordinal": c.ordinal},
            )
            for i, c in enumerate(chunks)
        ]
        self.store.upsert(records)
        return doc_id, len(chunks), False

    def _update_source(self, source_id: str, *, status: str, error: str | None = None) -> None:
        with self.db.session() as session:
            row = session.get(DataSourceRow, source_id)
            if row is None:
                return
            row.last_synced_at = datetime.now(UTC)
            row.last_status, row.last_error = status, error
            row.document_count = int(session.scalar(
                select(func.count()).select_from(DocumentRow)
                .where(DocumentRow.source_id == source_id, DocumentRow.status == "indexed")) or 0)

    def _bump_index_version(self) -> None:
        with self.db.session() as session:
            row = session.get(KeyValueRow, "index_version") or KeyValueRow(key="index_version", value={"version": 0})
            row.value = {"version": int(row.value.get("version", 0)) + 1, "at": datetime.now(UTC).isoformat()}
            session.merge(row)
