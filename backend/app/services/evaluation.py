"""Offline evaluation harness over data/eval/*.jsonl.

Metrics: retrieval recall@k and MRR (expected documents), answer groundedness and citation precision
(claim verification), keyword coverage, language fidelity, abstention/safety correctness, latency.
Reports are written to data/eval/reports/<timestamp>.json and summarised in the job result.
"""

from __future__ import annotations

import asyncio
import json
import logging
import statistics
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.core.language import detect_language
from app.db.base import Database
from app.db.models import DocumentRow
from app.retrieval.retriever import HybridRetriever
from app.schemas.api import ChatMessage, ChatRequest
from app.services.chat import ChatService
from app.settings import Settings

log = logging.getLogger(__name__)


class EvaluationService:
    def __init__(self, settings: Settings, db: Database, retriever: HybridRetriever, chat: ChatService) -> None:
        self.settings = settings
        self.db = db
        self.retriever = retriever
        self.chat = chat

    def _load(self, dataset: str | None) -> list[dict[str, Any]]:
        folder = self.settings.data_dir / "eval"
        files = [folder / dataset] if dataset else sorted(folder.glob("*.jsonl"))
        items = []
        for path in files:
            if not path.exists():
                raise FileNotFoundError(f"evaluation set not found: {path}")
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if line.strip():
                    item = json.loads(line)
                    item.setdefault("id", f"{path.stem}:{n}")
                    items.append(item)
        return items

    def _aliases(self) -> dict[str, set[str]]:
        """document id → identifiers an evaluator may use (id, doi, pmid, file stem, path)."""
        out: dict[str, set[str]] = {}
        with self.db.session() as session:
            for doc_id, doi, pmid, path in session.execute(
                    select(DocumentRow.id, DocumentRow.doi, DocumentRow.pmid, DocumentRow.path)):
                stem = Path(path.split("#", 1)[0]).stem.lower()
                ids = {doc_id.lower(), stem, path.lower()}
                if "#" in path:
                    ids.add(path.split("#", 1)[1].lower())
                if doi:
                    ids.add(doi.lower())
                if pmid:
                    ids.add(pmid)
                out[doc_id] = ids
        return out

    def run(self, dataset: str | None = None, k: int = 8, progress: Callable[[float, str], None] | None = None
            ) -> dict[str, Any]:
        progress = progress or (lambda _f, _m: None)
        items = self._load(dataset)
        if not items:
            return {"items": 0, "message": "no evaluation items found in data/eval/"}
        aliases = self._aliases()
        rows, latencies = [], []
        for i, item in enumerate(items):
            progress(i / len(items), f"Evaluating {item['id']}")
            lang = item.get("language") or self.settings.default_language
            expected = {str(x).lower() for x in item.get("expected_documents") or []}
            t0 = time.perf_counter()
            retrieval = self.retriever.retrieve(item["question"], lang, k=k)
            ranked = [e.source.document_id for e in retrieval.evidence]
            rank = next((r for r, d in enumerate(ranked, 1) if aliases.get(d, set()) & expected), None)
            response = asyncio.run(self.chat.answer(ChatRequest(
                messages=[ChatMessage(role="user", content=item["question"])], language=lang, stream=False)))
            latencies.append((time.perf_counter() - t0) * 1000)
            answer_l = response.answer.lower()
            keywords = [str(kw).lower() for kw in item.get("expected_keywords") or []]
            refused = response.abstained or response.safety.level in ("emergency", "urgent")
            row = {
                "id": item["id"], "language": lang,
                "recall_at_k": None if not expected else float(rank is not None),
                "reciprocal_rank": None if not expected else (1 / rank if rank else 0.0),
                "grounded_ratio": response.verification.grounded_ratio if response.verification else None,
                "citation_precision": response.verification.citation_precision if response.verification else None,
                "keyword_coverage": (sum(kw in answer_l for kw in keywords) / len(keywords)) if keywords else None,
                "language_ok": response.abstained or detect_language(
                    response.answer, self.settings.supported_languages, hint=lang) == lang,
                "abstained": response.abstained, "safety_level": response.safety.level,
                "refusal_ok": (refused == bool(item.get("must_refuse"))) if "must_refuse" in item else None,
                "evidence_level": response.evidence.level if response.evidence else None,
            }
            if item.get("expected_safety_flag"):
                row["safety_flag_ok"] = item["expected_safety_flag"] in response.safety.flags
            rows.append(row)

        def mean(key: str) -> float | None:
            values = [r[key] for r in rows if r.get(key) is not None]
            return round(statistics.fmean(float(v) for v in values), 4) if values else None

        summary = {
            "items": len(rows), "k": k, "recall_at_k": mean("recall_at_k"), "mrr": mean("reciprocal_rank"),
            "groundedness": mean("grounded_ratio"), "citation_precision": mean("citation_precision"),
            "keyword_coverage": mean("keyword_coverage"), "language_fidelity": mean("language_ok"),
            "refusal_accuracy": mean("refusal_ok"), "safety_flag_accuracy": mean("safety_flag_ok"),
            "abstention_rate": mean("abstained"),
            "latency_ms_p50": round(statistics.median(latencies), 1),
            "latency_ms_p95": round(sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)], 1),
            "model": self.chat.model_name,
        }
        out_dir = self.settings.data_dir / "eval" / "reports"
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        report = out_dir / f"{stamp}.json"
        report.write_text(json.dumps({"summary": summary, "rows": rows}, indent=2, ensure_ascii=False), "utf-8")
        progress(1.0, "Done")
        try:
            shown = str(report.relative_to(self.settings.project_root))
        except ValueError:
            shown = str(report)
        return {**summary, "report": shown}
