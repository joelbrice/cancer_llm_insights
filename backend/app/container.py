"""Service wiring. One container per process; tests build their own with custom settings."""

from __future__ import annotations

import logging
import threading
from functools import cached_property

from app.datasources.registry import SourceRegistry
from app.datasources.scanner import SourceScanner
from app.db.base import Database
from app.evidence.grading import EvidenceGrader
from app.evidence.verification import ClaimVerifier
from app.llm.extractive import ExtractiveComposer
from app.llm.providers import LLMProvider, build_llm
from app.retrieval.embeddings import Embedder, build_embedder
from app.retrieval.reranker import Reranker, build_reranker
from app.retrieval.retriever import HybridRetriever
from app.retrieval.sparse import BM25Encoder
from app.retrieval.vectorstores.base import VectorStore
from app.safety.guardrails import Guardrails
from app.settings import Settings, get_settings

log = logging.getLogger(__name__)


class Container:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = threading.RLock()

    @cached_property
    def db(self) -> Database:
        db = Database(self.settings.database_url, echo=self.settings.database_echo,  # type: ignore[arg-type]
                      pool_size=self.settings.database_pool_size)
        db.create_all()
        return db

    @cached_property
    def embedder(self) -> Embedder:
        return build_embedder(self.settings)

    @cached_property
    def sparse(self) -> BM25Encoder:
        s = self.settings
        return BM25Encoder(s.bm25_k1, s.bm25_b, s.bm25_avg_doc_tokens)

    @cached_property
    def store(self) -> VectorStore:
        s = self.settings
        if s.vector_store == "qdrant":
            from app.retrieval.vectorstores.qdrant import QdrantVectorStore

            key = s.qdrant_api_key.get_secret_value() if s.qdrant_api_key else None
            return QdrantVectorStore(s.qdrant_url, key, s.qdrant_collection, s.qdrant_shards,  # type: ignore[arg-type]
                                     s.qdrant_replicas)
        from app.retrieval.vectorstores.local import LocalVectorStore

        return LocalVectorStore(s.index_dir)  # type: ignore[arg-type]

    @cached_property
    def reranker(self) -> Reranker:
        return build_reranker(self.settings, self.embedder.semantic)

    @cached_property
    def retriever(self) -> HybridRetriever:
        return HybridRetriever(self.settings, self.embedder, self.sparse, self.store, self.reranker)

    @cached_property
    def guardrails(self) -> Guardrails:
        return Guardrails()

    @cached_property
    def verifier(self) -> ClaimVerifier:
        return ClaimVerifier(self.settings, self.embedder)

    @cached_property
    def grader(self) -> EvidenceGrader:
        return EvidenceGrader()

    @cached_property
    def llm(self) -> LLMProvider | None:
        return build_llm(self.settings)

    @cached_property
    def composer(self) -> ExtractiveComposer:
        return ExtractiveComposer(self.embedder)

    @cached_property
    def registry(self) -> SourceRegistry:
        return SourceRegistry(self.settings, self.db)

    @cached_property
    def scanner(self) -> SourceScanner:
        return SourceScanner(self.settings)

    @cached_property
    def ingestion(self):
        from app.services.ingestion import IngestionService

        return IngestionService(self.settings, self.db, self.registry, self.scanner, self.embedder, self.sparse,
                                self.store)

    @cached_property
    def insights(self):
        from app.services.insights import InsightService

        return InsightService(self.settings, self.db, self.retriever, self.verifier, self.grader, self.embedder,
                              self.llm, self.composer)

    @cached_property
    def chat(self):
        from app.services.chat import ChatService

        return ChatService(self.settings, self.db, self.retriever, self.store, self.verifier, self.grader,
                           self.guardrails, self.llm, self.composer, self.insights)

    @cached_property
    def platform(self):
        from app.services.platform import PlatformService

        return PlatformService(self)

    @cached_property
    def evaluation(self):
        from app.services.evaluation import EvaluationService

        return EvaluationService(self.settings, self.db, self.retriever, self.chat)

    @cached_property
    def sft_export(self):
        from app.services.sft_export import SFTExporter

        return SFTExporter(self.settings, self.retriever, self.insights, self.composer, self.guardrails)

    @cached_property
    def jobs(self):
        from app.workers.jobs import InlineQueue, JobManager, RQQueue
        from app.workers.tasks import run_job

        manager = JobManager(self.settings, self.db)
        manager.queue = RQQueue(self.settings) if self.settings.queue_backend == "rq" else InlineQueue(run_job)
        return manager

    def refresh_gauges(self) -> None:
        from app.core.metrics import INDEXED_DOCUMENTS, PUBLISHED_INSIGHTS

        try:
            INDEXED_DOCUMENTS.set(self.platform.document_count())
            PUBLISHED_INSIGHTS.set(self.insights.count_published())
        except Exception:  # metrics must never break a request
            log.debug("gauge refresh failed", exc_info=True)

    def close(self) -> None:
        if "jobs" in self.__dict__ and hasattr(self.jobs.queue, "shutdown"):
            self.jobs.queue.shutdown()
        if "store" in self.__dict__:
            self.store.persist()
        if "db" in self.__dict__:
            self.db.dispose()


_container: Container | None = None
_container_lock = threading.Lock()


def get_container() -> Container:
    global _container
    with _container_lock:
        if _container is None:
            _container = Container(get_settings())
        return _container


def set_container(container: Container | None) -> None:
    global _container
    with _container_lock:
        _container = container
