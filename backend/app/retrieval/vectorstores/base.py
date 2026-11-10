"""Vector store contract shared by the local and Qdrant implementations."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.retrieval.sparse import SparseVector


@dataclass(slots=True)
class VectorRecord:
    id: str
    vector: np.ndarray
    sparse: SparseVector
    payload: dict[str, Any]


@dataclass(slots=True)
class ScoredPoint:
    id: str
    score: float
    payload: dict[str, Any]


@dataclass(slots=True)
class SearchFilters:
    languages: list[str] | None = None
    source_types: list[str] | None = None
    min_year: int | None = None
    max_year: int | None = None
    cancer_types: list[str] | None = None
    topics: list[str] | None = None
    document_ids: list[str] | None = None
    source_ids: list[str] | None = None
    min_quality: float | None = None
    exclude_retracted: bool = True
    extra: dict[str, Any] = field(default_factory=dict)

    def matches(self, payload: dict[str, Any]) -> bool:
        if self.exclude_retracted and payload.get("retracted"):
            return False
        if self.languages and payload.get("language") not in self.languages:
            return False
        if self.source_types and payload.get("source_type") not in self.source_types:
            return False
        year = payload.get("year")
        if self.min_year and (year is None or year < self.min_year):
            return False
        if self.max_year and (year is None or year > self.max_year):
            return False
        if self.cancer_types and not set(self.cancer_types) & set(payload.get("cancer_types") or []):
            return False
        if self.topics and not set(self.topics) & set(payload.get("topics") or []):
            return False
        if self.document_ids and payload.get("document_id") not in self.document_ids:
            return False
        if self.source_ids and payload.get("source_id") not in self.source_ids:
            return False
        return not (self.min_quality is not None and float(payload.get("quality_score") or 0) < self.min_quality)


class VectorStore(ABC):
    name: str

    @abstractmethod
    def ensure(self, dim: int) -> None: ...

    @abstractmethod
    def upsert(self, records: list[VectorRecord]) -> None: ...

    @abstractmethod
    def delete_documents(self, document_ids: list[str]) -> None: ...

    @abstractmethod
    def search_dense(self, vector: np.ndarray, limit: int, filters: SearchFilters | None = None) -> list[ScoredPoint]:
        ...

    @abstractmethod
    def search_sparse(self, query: SparseVector, limit: int, filters: SearchFilters | None = None) -> list[ScoredPoint]:
        ...

    @abstractmethod
    def get_vectors(self, ids: list[str]) -> dict[str, np.ndarray]: ...

    @abstractmethod
    def term_presence(self, term_ids: list[int]) -> dict[int, bool]:
        """Whether each sparse term occurs anywhere in the (non-retracted) corpus."""

    @abstractmethod
    def count(self) -> int: ...

    def persist(self) -> None:  # noqa: B027 - optional hook
        """Flush to durable storage (no-op for servers)."""

    @abstractmethod
    def reset(self) -> None: ...

    def health(self) -> bool:
        return True
