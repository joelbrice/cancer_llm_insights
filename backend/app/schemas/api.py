"""Request/response models of the public HTTP API (mirrored in packages/shared/src/types.ts)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.safety.guardrails import SafetyAssessment
from app.schemas.evidence import Citation, EvidenceAssessment, SourceRef, Verification

Audience = Literal["prevention", "living_with_cancer", "caregivers"]


# ── Chat ─────────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class Profile(BaseModel):
    """Optional personal context. Kept on the user's device and sent per request — never stored server-side."""

    audience: Audience | None = None
    age_range: Literal["<30", "30-39", "40-49", "50-59", "60-69", "70+"] | None = None
    sex: Literal["female", "male", "intersex", "prefer_not_to_say"] | None = None
    cancer_types: list[str] = Field(default_factory=list, max_length=5)
    treatment_phase: Literal["pre_treatment", "in_treatment", "post_treatment", "advanced", "survivorship"] | None = None
    goals: list[str] = Field(default_factory=list, max_length=6)
    country: str | None = Field(default=None, max_length=2, description="ISO 3166-1 alpha-2, for local crisis lines")

    @field_validator("cancer_types", "goals")
    @classmethod
    def _clean(cls, values: list[str]) -> list[str]:
        return [v.strip().lower()[:40] for v in values if v and v.strip()]


class EvidenceFilters(BaseModel):
    source_types: list[str] | None = None
    min_year: int | None = Field(default=None, ge=1900, le=2100)
    languages: list[str] | None = None
    cancer_types: list[str] | None = None
    min_quality: float | None = Field(default=None, ge=0, le=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    language: str | None = Field(default=None, description="Force answer language; detected when omitted")
    ui_language: str | None = None
    profile: Profile | None = None
    filters: EvidenceFilters | None = None
    stream: bool = True


class RelatedInsight(BaseModel):
    id: str
    title: str
    category: str
    evidence_level: str


class ChatResponse(BaseModel):
    id: str
    answer: str
    language: str
    abstained: bool = False
    abstain_reason: str | None = None
    citations: list[Citation] = Field(default_factory=list)
    evidence: EvidenceAssessment | None = None
    verification: Verification | None = None
    safety: SafetyAssessment
    output_flags: list[str] = Field(default_factory=list)
    related_insights: list[RelatedInsight] = Field(default_factory=list)
    disclaimer: str
    model: str
    timings_ms: dict[str, float] = Field(default_factory=dict)
    retrieved: int = 0


# ── Search ───────────────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    language: str | None = None
    top_k: int = Field(default=10, ge=1, le=50)
    filters: EvidenceFilters | None = None


class SearchResponse(BaseModel):
    query: str
    language: str
    results: list[Citation]
    evidence: EvidenceAssessment
    took_ms: float


# ── Insights ─────────────────────────────────────────────────────────────────
class InsightPoint(BaseModel):
    text: str
    citations: list[int] = Field(default_factory=list)
    support: float | None = None
    label: str = "not_assessed"


class InsightSummary(BaseModel):
    id: str
    topic_id: str
    language: str
    category: str
    audience: list[str]
    cancer_types: list[str]
    title: str
    question: str
    summary: str
    evidence_level: str
    evidence_grade: str
    evidence_score: float
    n_sources: int
    status: str
    updated_at: datetime


class Insight(InsightSummary):
    key_points: list[InsightPoint]
    recommendations: list[InsightPoint]
    limitations: list[str]
    citations: list[Citation]
    evidence: EvidenceAssessment
    model: str
    prompt_version: str
    version: int
    generated_at: datetime


class InsightList(BaseModel):
    items: list[InsightSummary]
    total: int
    page: int
    page_size: int


class TopicStatus(BaseModel):
    id: str
    category: str
    audience: list[str]
    title: str
    question: str
    status: str  # published | insufficient_evidence | pending
    evidence_level: str | None = None
    insight_id: str | None = None


# ── Documents ────────────────────────────────────────────────────────────────
class DocumentSummary(BaseModel):
    id: str
    source_id: str
    title: str
    authors: list[str]
    year: int | None
    journal: str | None
    publisher: str | None
    doi: str | None
    pmid: str | None
    url: str | None
    language: str
    source_type: str
    source_type_label: str
    source_type_basis: str | None
    source_type_confidence: float
    credibility: str
    quality_score: float
    n_chunks: int
    status: str
    retracted: bool
    license: str | None
    indexed_at: datetime | None


class ChunkOut(BaseModel):
    id: str
    ordinal: int
    text: str
    section: str | None
    page_start: int | None
    page_end: int | None


class DocumentDetail(DocumentSummary):
    abstract: str | None
    topics: list[str]
    cancer_types: list[str]
    error: str | None
    chunks: list[ChunkOut]
    cited_by: list[RelatedInsight]
    source: SourceRef


class DocumentList(BaseModel):
    items: list[DocumentSummary]
    total: int
    page: int
    page_size: int
    facets: dict[str, dict[str, int]] = Field(default_factory=dict)


# ── Status & meta ────────────────────────────────────────────────────────────
class SourceStatus(BaseModel):
    id: str
    name: str
    kind: str
    uri: str
    enabled: bool
    origin: str
    last_synced_at: datetime | None
    last_status: str
    last_error: str | None
    documents: int


class PlatformStatus(BaseModel):
    app: str
    version: str
    environment: str
    data_status: Literal["awaiting_data", "indexing", "ready", "degraded"]
    documents: int
    chunks: int
    insights: int
    index_version: int
    sources: list[SourceStatus]
    llm: dict[str, Any]
    embeddings: dict[str, Any]
    vector_store: dict[str, Any]
    languages: list[str]
    active_job: dict[str, Any] | None = None
    admin_protected: bool
    sync_interval_seconds: int


# ── Admin ────────────────────────────────────────────────────────────────────
class SourceCreate(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,62}$")
    name: str = Field(min_length=1, max_length=200)
    uri: str = Field(min_length=1, max_length=1024)
    enabled: bool = True
    include: list[str] | None = None
    exclude: list[str] | None = None
    storage_options: dict[str, Any] = Field(default_factory=dict)
    defaults: dict[str, Any] = Field(default_factory=dict)

    @field_validator("storage_options")
    @classmethod
    def _no_plaintext_secrets(cls, value: dict[str, Any]) -> dict[str, Any]:
        def walk(obj: Any, key: str = "") -> None:
            if isinstance(obj, dict):
                for k, v in obj.items():
                    walk(v, k)
            elif (isinstance(obj, str) and not obj.startswith("${")
                  and any(s in key.lower() for s in ("secret", "key", "token", "password", "credential", "sas"))):
                raise ValueError(f"'{key}' must reference an environment variable, e.g. ${{MY_SECRET}}")
        walk(value)
        return value


class SourceUpdate(BaseModel):
    name: str | None = None
    uri: str | None = None
    enabled: bool | None = None
    include: list[str] | None = None
    exclude: list[str] | None = None
    defaults: dict[str, Any] | None = None


class IngestRequest(BaseModel):
    source_ids: list[str] | None = None
    mode: Literal["incremental", "full"] = "incremental"


class InsightBuildRequest(BaseModel):
    topic_ids: list[str] | None = None
    languages: list[str] | None = None
    force: bool = False


class EvaluateRequest(BaseModel):
    dataset: str | None = Field(default=None, description="File name in data/eval/ (default: all *.jsonl)")
    k: int = Field(default=8, ge=1, le=50)


class ExportRequest(BaseModel):
    languages: list[str] | None = None
    max_examples: int = Field(default=5000, ge=10, le=500_000)
    distractors: int = Field(default=2, ge=0, le=6)


class Job(BaseModel):
    id: str
    kind: str
    status: str
    triggered_by: str
    params: dict[str, Any]
    progress: float
    message: str | None
    stats: dict[str, Any]
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class FeedbackCreate(BaseModel):
    target_type: Literal["answer", "insight", "citation"]
    target_id: str = Field(min_length=1, max_length=120)
    rating: Literal[-1, 1]
    reasons: list[Literal["inaccurate", "not_supported", "unclear", "unsafe", "outdated", "helpful", "other"]] = \
        Field(default_factory=list)
    comment: str | None = Field(default=None, max_length=2000)
    language: str | None = None
