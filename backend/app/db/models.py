"""Relational metadata model. Vectors live in the vector store; the DB is the source of truth for text."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class DataSourceRow(Base):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    uri: Mapped[str] = mapped_column(String(1024))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    origin: Mapped[str] = mapped_column(String(16), default="config")  # config | env | api
    include: Mapped[list | None] = mapped_column(default=None)
    exclude: Mapped[list | None] = mapped_column(default=None)
    storage_options: Mapped[dict | None] = mapped_column(default=None)  # ${ENV} references only
    defaults: Mapped[dict | None] = mapped_column(default=None)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_status: Mapped[str] = mapped_column(String(16), default="never")  # never | ok | error | unreachable
    last_error: Mapped[str | None] = mapped_column(Text)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class DocumentRow(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("source_id", "path", name="uq_document_source_path"),
        Index("ix_documents_status_type", "status", "source_type"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64), index=True)
    path: Mapped[str] = mapped_column(String(1024))
    uri: Mapped[str] = mapped_column(String(2048))
    file_fingerprint: Mapped[str] = mapped_column(String(128))
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(1000))
    authors: Mapped[list] = mapped_column(default=list)
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    published_date: Mapped[str | None] = mapped_column(String(32))
    journal: Mapped[str | None] = mapped_column(String(500))
    publisher: Mapped[str | None] = mapped_column(String(500))
    doi: Mapped[str | None] = mapped_column(String(255), index=True)
    pmid: Mapped[str | None] = mapped_column(String(32))
    pmcid: Mapped[str | None] = mapped_column(String(32))
    url: Mapped[str | None] = mapped_column(String(2048))
    language: Mapped[str] = mapped_column(String(8), index=True, default="en")
    source_type: Mapped[str] = mapped_column(String(32), default="unknown")
    source_type_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    source_type_basis: Mapped[str | None] = mapped_column(String(64))
    credibility: Mapped[str] = mapped_column(String(32), default="unverified")
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    topics: Mapped[list] = mapped_column(default=list)
    cancer_types: Mapped[list] = mapped_column(default=list)
    audience: Mapped[list] = mapped_column(default=list)
    license: Mapped[str | None] = mapped_column(String(128))
    retracted: Mapped[bool] = mapped_column(Boolean, default=False)
    sample_size: Mapped[int | None] = mapped_column(Integer)
    extra: Mapped[dict] = mapped_column(default=dict)
    abstract: Mapped[str | None] = mapped_column(Text)
    n_chunks: Mapped[int] = mapped_column(Integer, default=0)
    n_chars: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="indexed")  # indexed|failed|removed|duplicate
    error: Mapped[str | None] = mapped_column(Text)
    duplicate_of: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    chunks: Mapped[list[ChunkRow]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="ChunkRow.ordinal"
    )


class ChunkRow(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    section: Mapped[str | None] = mapped_column(String(500))
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)
    char_start: Mapped[int] = mapped_column(Integer, default=0)
    char_end: Mapped[int] = mapped_column(Integer, default=0)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(8), default="en")
    content_hash: Mapped[str] = mapped_column(String(64))

    document: Mapped[DocumentRow] = relationship(back_populates="chunks")


class JobRow(Base):
    __tablename__ = "jobs"
    __table_args__ = (Index("ix_jobs_kind_status", "kind", "status"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))  # ingest | insights | evaluate | export_sft
    status: Mapped[str] = mapped_column(String(16), default="queued")
    triggered_by: Mapped[str] = mapped_column(String(16), default="api")
    params: Mapped[dict] = mapped_column(default=dict)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    message: Mapped[str | None] = mapped_column(String(500))
    stats: Mapped[dict] = mapped_column(default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    log: Mapped[list] = mapped_column(default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InsightRow(Base):
    __tablename__ = "insights"
    __table_args__ = (
        UniqueConstraint("topic_id", "language", name="uq_insight_topic_language"),
        Index("ix_insights_filter", "language", "status", "category"),
    )

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(100), index=True)
    language: Mapped[str] = mapped_column(String(8))
    category: Mapped[str] = mapped_column(String(64))
    audience: Mapped[list] = mapped_column(default=list)
    cancer_types: Mapped[list] = mapped_column(default=list)
    title: Mapped[str] = mapped_column(String(500))
    question: Mapped[str] = mapped_column(String(1000))
    summary: Mapped[str] = mapped_column(Text, default="")
    key_points: Mapped[list] = mapped_column(default=list)
    recommendations: Mapped[list] = mapped_column(default=list)
    limitations: Mapped[list] = mapped_column(default=list)
    citations: Mapped[list] = mapped_column(default=list)
    evidence: Mapped[dict] = mapped_column(default=dict)
    evidence_level: Mapped[str] = mapped_column(String(16), default="insufficient", index=True)
    evidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(24), default="published")  # published|insufficient_evidence|needs_review
    source_fingerprint: Mapped[str] = mapped_column(String(64), default="")
    model: Mapped[str] = mapped_column(String(200), default="")
    prompt_version: Mapped[str] = mapped_column(String(32), default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class FeedbackRow(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    target_type: Mapped[str] = mapped_column(String(16))  # answer | insight | citation
    target_id: Mapped[str] = mapped_column(String(120), index=True)
    rating: Mapped[int] = mapped_column(Integer)  # -1 | 1
    reasons: Mapped[list] = mapped_column(default=list)
    comment: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(String(8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ChatTraceRow(Base):
    __tablename__ = "chat_traces"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    language: Mapped[str] = mapped_column(String(8))
    query: Mapped[str] = mapped_column(Text)  # PII-scrubbed
    answer: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(default=list)
    evidence: Mapped[dict] = mapped_column(default=dict)
    safety: Mapped[dict] = mapped_column(default=dict)
    retrieval: Mapped[dict] = mapped_column(default=dict)
    model: Mapped[str] = mapped_column(String(200))
    latency_ms: Mapped[int] = mapped_column(Integer)


class LockRow(Base):
    __tablename__ = "locks"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class KeyValueRow(Base):
    __tablename__ = "kv"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
