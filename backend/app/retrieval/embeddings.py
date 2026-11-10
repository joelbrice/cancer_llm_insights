"""Dense embedding providers.

* `hashing` — deterministic, dependency-free feature hashing (word + char n-grams). Offline/dev/tests;
  lexical, not cross-lingual.
* `sentence_transformers` — local multilingual model (default intfloat/multilingual-e5-base, or BAAI/bge-m3).
* `openai_compatible` — any /v1/embeddings server (Text-Embeddings-Inference, vLLM, Ollama, OpenAI …).
All providers return L2-normalised float32 matrices.
"""

from __future__ import annotations

import hashlib
import itertools
import logging
import time
from abc import ABC, abstractmethod
from functools import lru_cache

import httpx
import numpy as np

from app.core.text import STOPWORDS, fold_accents, words
from app.settings import Settings

log = logging.getLogger(__name__)
_ALL_STOP = frozenset().union(*STOPWORDS.values())


def _normalize(matrix: np.ndarray) -> np.ndarray:
    matrix = np.asarray(matrix, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


class Embedder(ABC):
    name: str
    dim: int
    semantic: bool = False  # True for neural models (enables cross-lingual verification)

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> np.ndarray: ...

    @abstractmethod
    def embed_queries(self, texts: list[str]) -> np.ndarray: ...

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed_queries([text])[0]


class HashingEmbedder(Embedder):
    semantic = False

    def __init__(self, dim: int = 768) -> None:
        self.dim = dim
        self.name = f"hashing-{dim}"

    @staticmethod
    @lru_cache(maxsize=500_000)
    def _slot(feature: str, dim: int) -> tuple[int, float]:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "little")
        return value % dim, (1.0 if (value >> 63) & 1 else -1.0)

    def _vector(self, text: str) -> np.ndarray:
        vec = np.zeros(self.dim, dtype=np.float32)
        tokens = [fold_accents(t.lower()) for t in words(text)]
        content = [t for t in tokens if t not in _ALL_STOP and len(t) > 1]
        counts: dict[str, float] = {}
        for t in content:
            counts["w:" + t] = counts.get("w:" + t, 0.0) + 1.0
            padded = f"<{t}>"
            for n in (4,):
                for i in range(max(1, len(padded) - n + 1)):
                    key = "c:" + padded[i: i + n]
                    counts[key] = counts.get(key, 0.0) + 0.35
        for a, b in itertools.pairwise(content):
            counts[f"b:{a}_{b}"] = counts.get(f"b:{a}_{b}", 0.0) + 0.5
        for feature, weight in counts.items():
            idx, sign = self._slot(feature, self.dim)
            vec[idx] += sign * (1.0 + np.log(weight)) if weight >= 1 else sign * weight
        return vec

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        return _normalize(np.stack([self._vector(t) for t in texts]))

    def embed_queries(self, texts: list[str]) -> np.ndarray:
        return self.embed_documents(texts)


class SentenceTransformerEmbedder(Embedder):
    semantic = True

    def __init__(self, model: str, device: str | None = None, batch_size: int = 32, cache_dir: str | None = None):
        from sentence_transformers import SentenceTransformer  # heavy import, optional extra

        self.model = SentenceTransformer(model, device=device, cache_folder=cache_dir)
        self.name = model
        self.dim = int(self.model.get_sentence_embedding_dimension())
        self.batch_size = batch_size
        lowered = model.lower()
        self._prefix = ("query: ", "passage: ") if "e5" in lowered else ("", "")

    def _encode(self, texts: list[str]) -> np.ndarray:
        return self.model.encode(texts, batch_size=self.batch_size, normalize_embeddings=True,
                                 convert_to_numpy=True, show_progress_bar=False).astype(np.float32)

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return self._encode([self._prefix[1] + t for t in texts])

    def embed_queries(self, texts: list[str]) -> np.ndarray:
        return self._encode([self._prefix[0] + t for t in texts])


class OpenAICompatibleEmbedder(Embedder):
    semantic = True

    def __init__(self, base_url: str, model: str, api_key: str | None, dim: int, batch_size: int = 32,
                 timeout: float = 60.0, max_retries: int = 3) -> None:
        self.name = model
        self.dim = dim
        self.batch_size = batch_size
        self.max_retries = max_retries
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._client = httpx.Client(base_url=base_url.rstrip("/"), headers=headers, timeout=timeout)
        lowered = model.lower()
        self._prefix = ("query: ", "passage: ") if "e5" in lowered else ("", "")

    def _post(self, batch: list[str]) -> list[list[float]]:
        delay = 1.0
        for attempt in range(self.max_retries + 1):
            try:
                response = self._client.post("/embeddings", json={"model": self.name, "input": batch})
                response.raise_for_status()
                data = sorted(response.json()["data"], key=lambda d: d["index"])
                return [d["embedding"] for d in data]
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                retriable = not isinstance(exc, httpx.HTTPStatusError) or exc.response.status_code >= 500 \
                    or exc.response.status_code == 429
                if attempt >= self.max_retries or not retriable:
                    raise
                log.warning("embedding request failed (%s), retrying in %.1fs", exc, delay)
                time.sleep(delay)
                delay *= 2
        raise RuntimeError("unreachable")

    def _embed(self, texts: list[str]) -> np.ndarray:
        vectors: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            vectors.extend(self._post(texts[i: i + self.batch_size]))
        matrix = _normalize(np.array(vectors, dtype=np.float32)) if vectors else np.zeros((0, self.dim), np.float32)
        if matrix.size and matrix.shape[1] != self.dim:
            log.info("embedding dimension discovered: %d (configured %d)", matrix.shape[1], self.dim)
            self.dim = int(matrix.shape[1])
        return matrix

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return self._embed([self._prefix[1] + t for t in texts])

    def embed_queries(self, texts: list[str]) -> np.ndarray:
        return self._embed([self._prefix[0] + t for t in texts])


def build_embedder(settings: Settings) -> Embedder:
    provider = settings.embedding_provider
    if provider == "sentence_transformers":
        return SentenceTransformerEmbedder(settings.embedding_model, settings.embedding_device,
                                           settings.embedding_batch_size, str(settings.data_dir / "cache"))
    if provider == "openai_compatible":
        if not settings.embedding_base_url:
            raise ValueError("EMBEDDING_PROVIDER=openai_compatible requires EMBEDDING_BASE_URL")
        key = settings.embedding_api_key.get_secret_value() if settings.embedding_api_key else None
        return OpenAICompatibleEmbedder(settings.embedding_base_url, settings.embedding_model, key,
                                        settings.embedding_dim, settings.embedding_batch_size)
    return HashingEmbedder(settings.embedding_dim)
