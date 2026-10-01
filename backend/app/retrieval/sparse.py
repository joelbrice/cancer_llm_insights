"""BM25 as sparse vectors (hashed term ids).

Document vectors carry the BM25 term-frequency component; IDF is applied at query time — by the local
store from its own statistics, or by Qdrant's `Modifier.IDF`. This scales to very large corpora because
no global vocabulary has to be maintained.
"""

from __future__ import annotations

import hashlib
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

from app.core.text import analyze


@dataclass(slots=True)
class SparseVector:
    indices: list[int]
    values: list[float]

    def as_dict(self) -> dict[int, float]:
        return dict(zip(self.indices, self.values, strict=True))


@lru_cache(maxsize=500_000)
def term_id(term: str) -> int:
    return int.from_bytes(hashlib.blake2b(term.encode("utf-8"), digest_size=4).digest(), "little") & 0x7FFFFFFF


class BM25Encoder:
    def __init__(self, k1: float = 1.2, b: float = 0.75, avg_doc_tokens: float = 220.0) -> None:
        self.k1, self.b, self.avgdl = k1, b, avg_doc_tokens

    def encode_document(self, text: str, language: str | None) -> SparseVector:
        terms = analyze(text, language)
        if not terms:
            return SparseVector([], [])
        counts = Counter(term_id(t) for t in terms)
        length_norm = self.k1 * (1 - self.b + self.b * len(terms) / self.avgdl)
        indices = list(counts)
        values = [round(tf * (self.k1 + 1) / (tf + length_norm), 5) for tf in counts.values()]
        return SparseVector(indices, values)

    def encode_query(self, text: str, language: str | None) -> SparseVector:
        counts = Counter(term_id(t) for t in analyze(text, language))
        return SparseVector(list(counts), [1.0] * len(counts))
