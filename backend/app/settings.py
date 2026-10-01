"""Application settings, loaded from environment variables and `.env` files.

Every knob of the platform is configurable here so that the same image runs on a
laptop (SQLite + local index + extractive answers) and in production (Postgres +
Qdrant + a fine-tuned LLaMA served by vLLM) without code changes.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

CsvList = Annotated[list[str], NoDecode]


def _split_csv(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("["):
            import json

            return json.loads(value)
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "Stepwell"
    version: str = "1.0.0"
    environment: Literal["development", "test", "staging", "production"] = "development"
    log_level: str = "INFO"
    log_json: bool = False
    api_prefix: str = "/api/v1"

    # ── Paths & data link ────────────────────────────────────────────────────
    project_root: Path = PROJECT_ROOT
    data_dir: Path = PROJECT_ROOT / "data"
    data_sources_file: Path | None = None
    data_source_uri: str | None = Field(
        default=None,
        description="Shortcut to register one extra source, e.g. s3://bucket/prefix or /mnt/corpus",
    )
    max_file_size_mb: int = 80

    # ── Metadata database ────────────────────────────────────────────────────
    database_url: str | None = None
    database_pool_size: int = 10
    database_echo: bool = False

    # ── Vector store ─────────────────────────────────────────────────────────
    vector_store: Literal["local", "qdrant"] = "local"
    index_dir: Path | None = None
    qdrant_url: str | None = None
    qdrant_api_key: SecretStr | None = None
    qdrant_collection: str = "cancer_chunks"
    qdrant_shards: int = 2
    qdrant_replicas: int = 1

    # ── Embeddings ───────────────────────────────────────────────────────────
    embedding_provider: Literal["hashing", "sentence_transformers", "openai_compatible"] = "hashing"
    embedding_model: str = "intfloat/multilingual-e5-base"
    embedding_dim: int = 768
    embedding_base_url: str | None = None
    embedding_api_key: SecretStr | None = None
    embedding_batch_size: int = 32
    embedding_device: str | None = None

    # ── Reranking & verification ─────────────────────────────────────────────
    reranker_provider: Literal["none", "lexical", "cross_encoder"] = "lexical"
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    verifier_provider: Literal["lexical", "nli"] = "lexical"
    verifier_model: str = "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"
    support_threshold: float = 0.52
    partial_support_threshold: float = 0.36
    semantic_support_floor: float = 0.70  # cosine at which semantic support starts counting
    semantic_support_ceiling: float = 0.90  # cosine treated as full support (model-dependent)

    # ── LLM (fine-tuned LLaMA via any OpenAI-compatible server: vLLM, TGI, Ollama, llama.cpp) ──
    llm_provider: Literal["extractive", "openai_compatible"] = "extractive"
    llm_base_url: str = "http://localhost:8001/v1"
    llm_api_key: SecretStr | None = None
    llm_model: str = "cancer-insights-llama"
    llm_temperature: float = 0.2
    llm_top_p: float = 0.9
    llm_max_tokens: int = 900
    llm_timeout_seconds: float = 120.0
    llm_context_tokens: int = 8192
    llm_max_retries: int = 2

    # ── Retrieval ────────────────────────────────────────────────────────────
    chunk_size_tokens: int = 300
    chunk_overlap_tokens: int = 45
    retrieval_candidates: int = 40
    retrieval_top_k: int = 8
    retrieval_max_chunks_per_document: int = 2
    retrieval_min_relevance: float = 0.12
    answerability_threshold: float = 0.56  # ½·best relevance + ½·query coverage; below → honest abstention
    retrieval_mmr_lambda: float = 0.72
    rrf_k: int = 60
    bm25_k1: float = 1.2
    bm25_b: float = 0.75
    bm25_avg_doc_tokens: float = 220.0

    # ── Languages ────────────────────────────────────────────────────────────
    supported_languages: CsvList = ["en", "fr", "es", "pt", "de"]
    default_language: str = "en"
    insight_languages: CsvList = ["en", "fr", "es", "pt", "de"]  # every UI language gets its own insights

    # ── Insights ─────────────────────────────────────────────────────────────
    insight_topics_file: Path | None = None
    insight_min_sources: int = 2
    insight_evidence_k: int = 10
    auto_build_insights: bool = True

    # ── Jobs, scheduling & caching ───────────────────────────────────────────
    queue_backend: Literal["inline", "rq"] = "inline"
    redis_url: str | None = None
    queue_name: str = "cancer-insights"
    job_timeout_seconds: int = 6 * 3600
    sync_interval_seconds: int = 300
    run_scheduler: bool = True
    cache_ttl_seconds: int = 600

    # ── Security & privacy ───────────────────────────────────────────────────
    admin_api_key: SecretStr | None = None
    cors_origins: CsvList = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://localhost:19006",
    ]
    rate_limit_per_minute: int = 120
    chat_rate_limit_per_minute: int = 20
    trust_forwarded_for: bool = False
    store_conversations: bool = False

    # ── Community (pseudonymous, members-only, moderated) ──────────────────────
    community_enabled: bool = True
    community_min_age: int = 18
    community_report_threshold: int = 3       # open reports that auto-hide a post pending review
    community_hold_first_posts: int = 0       # pre-moderate a new member's first N posts (0 = screen only)
    community_posts_per_hour: int = 6
    community_replies_per_hour: int = 30
    community_reports_per_day: int = 20
    community_reactions_per_hour: int = 300
    community_strikes_to_suspend: int = 3     # removed posts before automatic suspension

    # ── Retention (docs/BUILD_SPEC.md §10.1) ──────────────────────────────────
    community_removed_retention_days: int = 90
    feedback_retention_days: int = 365
    chat_trace_retention_days: int = 30
    max_message_chars: int = 4000
    max_history_messages: int = 12

    @field_validator("supported_languages", "insight_languages", "cors_origins", mode="before")
    @classmethod
    def _csv(cls, value: object) -> object:
        return _split_csv(value)

    @model_validator(mode="after")
    def _derive_paths(self) -> Settings:
        self.data_dir = Path(self.data_dir).resolve()
        if self.data_sources_file is None:
            self.data_sources_file = self.data_dir / "sources.yaml"
        if self.index_dir is None:
            self.index_dir = self.data_dir / "index"
        if self.database_url is None:
            self.database_url = f"sqlite:///{self.data_dir / 'app.db'}"
        if self.insight_topics_file is None:
            self.insight_topics_file = BACKEND_DIR / "app" / "resources" / "insight_topics.yaml"
        self.supported_languages = [lang.lower() for lang in self.supported_languages]
        if self.default_language not in self.supported_languages:
            self.supported_languages.insert(0, self.default_language)
        self.insight_languages = [
            lang for lang in (x.lower() for x in self.insight_languages) if lang in self.supported_languages
        ] or [self.default_language]
        if self.queue_backend == "rq" and not self.redis_url:
            raise ValueError("QUEUE_BACKEND=rq requires REDIS_URL")
        if self.vector_store == "qdrant" and not self.qdrant_url:
            raise ValueError("VECTOR_STORE=qdrant requires QDRANT_URL")
        if self.environment == "production" and self.admin_api_key is None:
            raise ValueError("ADMIN_API_KEY must be set in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def resolve_path(self, value: str | Path) -> Path:
        """Resolve a path relative to the project root (so `./data/raw` works from anywhere)."""
        path = Path(value).expanduser()
        return path if path.is_absolute() else (self.project_root / path).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
