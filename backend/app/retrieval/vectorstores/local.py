"""In-process vector + BM25 index persisted under data/index/local (development and small corpora).

Thread-safe; vectors live in a contiguous float32 matrix for fast exact cosine search, the sparse
index is an inverted list with BM25 IDF computed from live document frequencies.
"""

from __future__ import annotations

import json
import logging
import math
import os
import threading
from pathlib import Path

import numpy as np

from app.retrieval.sparse import SparseVector
from app.retrieval.vectorstores.base import ScoredPoint, SearchFilters, VectorRecord, VectorStore

log = logging.getLogger(__name__)


class LocalVectorStore(VectorStore):
    name = "local"

    def __init__(self, directory: Path) -> None:
        self.dir = Path(directory) / "local"
        self._lock = threading.RLock()
        self._ids: list[str] = []
        self._pos: dict[str, int] = {}
        self._payloads: list[dict] = []
        self._sparse: list[dict[int, float]] = []
        self._matrix = np.zeros((0, 0), dtype=np.float32)
        self._alive = np.zeros(0, dtype=bool)
        self._postings: dict[int, dict[int, float]] = {}
        self._dirty = False
        self._load()

    # ── persistence ──────────────────────────────────────────────────────────
    def _load(self) -> None:
        vectors, records = self.dir / "vectors.npy", self.dir / "records.jsonl"
        if not (vectors.exists() and records.exists()):
            return
        try:
            matrix = np.load(vectors)
            ids, payloads, sparse = [], [], []
            with records.open(encoding="utf-8") as handle:
                for line in handle:
                    item = json.loads(line)
                    ids.append(item["id"])
                    payloads.append(item["payload"])
                    sparse.append({int(k): float(v) for k, v in item["sparse"].items()})
            if len(ids) != matrix.shape[0]:
                raise ValueError("index files are inconsistent")
        except Exception as exc:
            log.error("local index unreadable (%s) — starting empty; re-run ingestion", exc)
            return
        self._ids, self._payloads, self._sparse, self._matrix = ids, payloads, sparse, matrix
        self._alive = np.ones(len(ids), dtype=bool)
        self._pos = {i: n for n, i in enumerate(ids)}
        self._rebuild_postings()
        log.info("local index loaded: %d chunks", len(ids))

    def persist(self) -> None:
        with self._lock:
            if not self._dirty:
                return
            self._compact()
            self.dir.mkdir(parents=True, exist_ok=True)
            tmp_vec, tmp_rec = self.dir / "vectors.tmp.npy", self.dir / "records.tmp.jsonl"
            np.save(tmp_vec, self._matrix)
            with tmp_rec.open("w", encoding="utf-8") as handle:
                for i, pid in enumerate(self._ids):
                    handle.write(json.dumps({"id": pid, "payload": self._payloads[i],
                                             "sparse": self._sparse[i]}, ensure_ascii=False) + "\n")
            os.replace(tmp_vec, self.dir / "vectors.npy")
            os.replace(tmp_rec, self.dir / "records.jsonl")
            self._dirty = False

    def _compact(self) -> None:
        if self._alive.all():
            return
        keep = np.flatnonzero(self._alive)
        self._ids = [self._ids[i] for i in keep]
        self._payloads = [self._payloads[i] for i in keep]
        self._sparse = [self._sparse[i] for i in keep]
        self._matrix = self._matrix[keep] if self._matrix.size else self._matrix
        self._alive = np.ones(len(self._ids), dtype=bool)
        self._pos = {pid: n for n, pid in enumerate(self._ids)}
        self._rebuild_postings()

    def _rebuild_postings(self) -> None:
        self._postings = {}
        for row, vec in enumerate(self._sparse):
            if self._alive[row]:
                for term, weight in vec.items():
                    self._postings.setdefault(term, {})[row] = weight

    # ── writes ───────────────────────────────────────────────────────────────
    def ensure(self, dim: int) -> None:
        with self._lock:
            if self._matrix.size == 0 and self._matrix.shape[1:] != (dim,):
                self._matrix = np.zeros((0, dim), dtype=np.float32)
            elif self._matrix.shape[1] != dim:
                raise ValueError(f"index dimension {self._matrix.shape[1]} ≠ embedder dimension {dim}; "
                                 "reset the index (`python -m app.cli reset-index`) after changing models")

    def upsert(self, records: list[VectorRecord]) -> None:
        if not records:
            return
        with self._lock:
            self.ensure(int(records[0].vector.shape[0]))
            new_rows = []
            for rec in records:
                if rec.id in self._pos and self._alive[self._pos[rec.id]]:
                    self._kill(self._pos[rec.id])
                new_rows.append(rec)
            start = len(self._ids)
            self._matrix = np.vstack([self._matrix, np.stack([r.vector for r in new_rows]).astype(np.float32)])
            self._alive = np.concatenate([self._alive, np.ones(len(new_rows), dtype=bool)])
            for offset, rec in enumerate(new_rows):
                row = start + offset
                self._ids.append(rec.id)
                self._payloads.append(rec.payload)
                sparse = rec.sparse.as_dict()
                self._sparse.append(sparse)
                self._pos[rec.id] = row
                for term, weight in sparse.items():
                    self._postings.setdefault(term, {})[row] = weight
            self._dirty = True

    def _kill(self, row: int) -> None:
        self._alive[row] = False
        for term in self._sparse[row]:
            bucket = self._postings.get(term)
            if bucket:
                bucket.pop(row, None)
                if not bucket:
                    del self._postings[term]

    def delete_documents(self, document_ids: list[str]) -> None:
        targets = set(document_ids)
        with self._lock:
            for row, payload in enumerate(self._payloads):
                if self._alive[row] and payload.get("document_id") in targets:
                    self._kill(row)
                    self._pos.pop(self._ids[row], None)
            self._dirty = True

    def reset(self) -> None:
        with self._lock:
            dim = self._matrix.shape[1] if self._matrix.ndim == 2 else 0
            self._ids, self._pos, self._payloads, self._sparse, self._postings = [], {}, [], [], {}
            self._matrix = np.zeros((0, dim), dtype=np.float32)
            self._alive = np.zeros(0, dtype=bool)
            self._dirty = True
            self.persist()

    # ── reads ────────────────────────────────────────────────────────────────
    def _mask(self, filters: SearchFilters | None) -> np.ndarray:
        mask = self._alive.copy()
        if filters is not None:
            for row in np.flatnonzero(mask):
                if not filters.matches(self._payloads[row]):
                    mask[row] = False
        return mask

    def search_dense(self, vector: np.ndarray, limit: int, filters: SearchFilters | None = None) -> list[ScoredPoint]:
        with self._lock:
            if not self._ids or self._matrix.size == 0:
                return []
            scores = self._matrix @ vector.astype(np.float32)
            mask = self._mask(filters)
            scores = np.where(mask, scores, -np.inf)
            k = min(limit, int(mask.sum()))
            if k <= 0:
                return []
            top = np.argpartition(-scores, k - 1)[:k]
            top = top[np.argsort(-scores[top])]
            return [ScoredPoint(self._ids[i], float(scores[i]), self._payloads[i]) for i in top]

    def search_sparse(self, query: SparseVector, limit: int, filters: SearchFilters | None = None) -> list[ScoredPoint]:
        with self._lock:
            n_docs = int(self._alive.sum())
            if not n_docs or not query.indices:
                return []
            scores: dict[int, float] = {}
            for term, q_weight in zip(query.indices, query.values, strict=True):
                bucket = self._postings.get(term)
                if not bucket:
                    continue
                idf = math.log(1 + (n_docs - len(bucket) + 0.5) / (len(bucket) + 0.5))
                for row, tf_weight in bucket.items():
                    scores[row] = scores.get(row, 0.0) + q_weight * idf * tf_weight
            ranked = sorted(scores.items(), key=lambda kv: -kv[1])
            out = []
            for row, score in ranked:
                if filters is None or filters.matches(self._payloads[row]):
                    out.append(ScoredPoint(self._ids[row], score, self._payloads[row]))
                    if len(out) >= limit:
                        break
            return out

    def get_vectors(self, ids: list[str]) -> dict[str, np.ndarray]:
        with self._lock:
            return {i: self._matrix[self._pos[i]] for i in ids if i in self._pos}

    def term_presence(self, term_ids: list[int]) -> dict[int, bool]:
        with self._lock:
            return {t: bool(self._postings.get(t)) for t in term_ids}

    def count(self) -> int:
        with self._lock:
            return int(self._alive.sum())
