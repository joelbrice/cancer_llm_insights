"""Qdrant vector store (production): named dense vector + BM25 sparse vector with server-side IDF."""

from __future__ import annotations

import logging
import uuid

import numpy as np

from app.retrieval.sparse import SparseVector
from app.retrieval.vectorstores.base import ScoredPoint, SearchFilters, VectorRecord, VectorStore

log = logging.getLogger(__name__)
DENSE, SPARSE = "dense", "bm25"
_NS = uuid.UUID("6f1b8a2e-4c55-4d3f-9a57-1f2b3c4d5e6f")
INDEXED_FIELDS = {
    "document_id": "keyword", "source_id": "keyword", "language": "keyword", "source_type": "keyword",
    "cancer_types": "keyword", "topics": "keyword", "year": "integer", "quality_score": "float",
    "retracted": "bool",
}


def point_id(chunk_id: str) -> str:
    return str(uuid.uuid5(_NS, chunk_id))  # Qdrant ids must be UUIDs or unsigned ints


class QdrantVectorStore(VectorStore):
    name = "qdrant"

    def __init__(self, url: str, api_key: str | None, collection: str, shards: int = 2, replicas: int = 1) -> None:
        from qdrant_client import QdrantClient

        self.client = QdrantClient(url=url, api_key=api_key, timeout=30, prefer_grpc=False)
        self.collection = collection
        self.shards, self.replicas = shards, replicas
        self._ready = False

    def ensure(self, dim: int) -> None:
        if self._ready:
            return
        from qdrant_client import models as qm

        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config={DENSE: qm.VectorParams(size=dim, distance=qm.Distance.COSINE, on_disk=True)},
                sparse_vectors_config={SPARSE: qm.SparseVectorParams(modifier=qm.Modifier.IDF)},
                shard_number=self.shards,
                replication_factor=self.replicas,
                hnsw_config=qm.HnswConfigDiff(m=16, ef_construct=128),
                optimizers_config=qm.OptimizersConfigDiff(indexing_threshold=20_000),
                quantization_config=qm.ScalarQuantization(
                    scalar=qm.ScalarQuantizationConfig(type=qm.ScalarType.INT8, always_ram=True)
                ),
            )
            schema = {"keyword": qm.PayloadSchemaType.KEYWORD, "integer": qm.PayloadSchemaType.INTEGER,
                      "float": qm.PayloadSchemaType.FLOAT, "bool": qm.PayloadSchemaType.BOOL}
            for field_name, kind in INDEXED_FIELDS.items():
                self.client.create_payload_index(self.collection, field_name, field_schema=schema[kind])
            log.info("created Qdrant collection %s (dim=%d)", self.collection, dim)
        else:
            info = self.client.get_collection(self.collection)
            existing = info.config.params.vectors[DENSE].size  # type: ignore[index]
            if existing != dim:
                raise ValueError(f"Qdrant collection dimension {existing} ≠ embedder dimension {dim}")
        self._ready = True

    def _filter(self, filters: SearchFilters | None):
        from qdrant_client import models as qm

        if filters is None:
            return None
        must, must_not = [], []
        if filters.exclude_retracted:
            must_not.append(qm.FieldCondition(key="retracted", match=qm.MatchValue(value=True)))
        for key, values in (("language", filters.languages), ("source_type", filters.source_types),
                            ("cancer_types", filters.cancer_types), ("topics", filters.topics),
                            ("document_id", filters.document_ids), ("source_id", filters.source_ids)):
            if values:
                must.append(qm.FieldCondition(key=key, match=qm.MatchAny(any=list(values))))
        if filters.min_year or filters.max_year:
            must.append(qm.FieldCondition(key="year", range=qm.Range(gte=filters.min_year, lte=filters.max_year)))
        if filters.min_quality is not None:
            must.append(qm.FieldCondition(key="quality_score", range=qm.Range(gte=filters.min_quality)))
        return qm.Filter(must=must or None, must_not=must_not or None)

    def upsert(self, records: list[VectorRecord]) -> None:
        from qdrant_client import models as qm

        if not records:
            return
        self.ensure(int(records[0].vector.shape[0]))
        for i in range(0, len(records), 256):
            batch = records[i: i + 256]
            self.client.upsert(
                collection_name=self.collection,
                points=[
                    qm.PointStruct(
                        id=point_id(r.id),
                        vector={DENSE: r.vector.tolist(),
                                SPARSE: qm.SparseVector(indices=r.sparse.indices, values=r.sparse.values)},
                        payload={**r.payload, "chunk_id": r.id},
                    )
                    for r in batch
                ],
                wait=True,
            )

    def delete_documents(self, document_ids: list[str]) -> None:
        from qdrant_client import models as qm

        if not document_ids or not self.client.collection_exists(self.collection):
            return
        self.client.delete(
            collection_name=self.collection,
            points_selector=qm.FilterSelector(filter=qm.Filter(
                must=[qm.FieldCondition(key="document_id", match=qm.MatchAny(any=document_ids))]
            )),
            wait=True,
        )

    def _to_points(self, hits) -> list[ScoredPoint]:
        return [ScoredPoint(h.payload.get("chunk_id", str(h.id)), float(h.score), dict(h.payload)) for h in hits]

    def search_dense(self, vector: np.ndarray, limit: int, filters: SearchFilters | None = None) -> list[ScoredPoint]:
        if not self.client.collection_exists(self.collection):
            return []
        from qdrant_client import models as qm

        result = self.client.query_points(
            collection_name=self.collection, query=vector.tolist(), using=DENSE, limit=limit,
            query_filter=self._filter(filters), with_payload=True,
            search_params=qm.SearchParams(hnsw_ef=128, quantization=qm.QuantizationSearchParams(rescore=True)),
        )
        return self._to_points(result.points)

    def search_sparse(self, query: SparseVector, limit: int, filters: SearchFilters | None = None) -> list[ScoredPoint]:
        if not query.indices or not self.client.collection_exists(self.collection):
            return []
        from qdrant_client import models as qm

        result = self.client.query_points(
            collection_name=self.collection,
            query=qm.SparseVector(indices=query.indices, values=query.values), using=SPARSE,
            limit=limit, query_filter=self._filter(filters), with_payload=True,
        )
        return self._to_points(result.points)

    def get_vectors(self, ids: list[str]) -> dict[str, np.ndarray]:
        if not ids:
            return {}
        points = self.client.retrieve(self.collection, ids=[point_id(i) for i in ids], with_vectors=[DENSE],
                                      with_payload=["chunk_id"])
        out = {}
        for p in points:
            vec = p.vector[DENSE] if isinstance(p.vector, dict) else p.vector
            out[p.payload["chunk_id"]] = np.asarray(vec, dtype=np.float32)
        return out

    def term_presence(self, term_ids: list[int]) -> dict[int, bool]:
        if not self.client.collection_exists(self.collection):
            return {t: False for t in term_ids}
        return {t: bool(self.search_sparse(SparseVector([t], [1.0]), 1)) for t in term_ids}

    def count(self) -> int:
        if not self.client.collection_exists(self.collection):
            return 0
        return int(self.client.count(self.collection, exact=False).count)

    def reset(self) -> None:
        if self.client.collection_exists(self.collection):
            self.client.delete_collection(self.collection)
        self._ready = False

    def health(self) -> bool:
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False
