"""Evaluate a served model (any OpenAI-compatible endpoint: vLLM, TGI, Ollama, llama.cpp) on held-out data,
or score a predictions file, then apply the release gates. Exit code 1 when a gate fails."""

from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx

from stepwell_ml.config import GateConfig
from stepwell_ml.data import read_jsonl
from stepwell_ml.metrics import aggregate, gates, score


def generate(base_url: str, model: str, messages: list[dict[str, str]], api_key: str | None, max_tokens: int = 700,
             retries: int = 2) -> str:
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    body = {"model": model, "messages": messages, "temperature": 0.0, "max_tokens": max_tokens}
    for attempt in range(retries + 1):
        try:
            r = httpx.post(base_url.rstrip("/") + "/chat/completions", json=body, headers=headers, timeout=180)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"] or ""
        except (httpx.HTTPError, KeyError):
            if attempt == retries:
                raise
            time.sleep(2 ** attempt)
    return ""


def run(dataset: Path, *, gates_config: GateConfig, base_url: str | None = None, model: str | None = None,
        api_key: str | None = None, predictions: Path | None = None, baseline: Path | None = None,
        limit: int | None = None, workers: int = 8, out: Path | None = None) -> dict[str, Any]:
    rows = [row for _, row, err in read_jsonl(dataset) if row and not err][: limit or None]
    if predictions is not None:
        preds = [json.loads(line)["prediction"] for line in predictions.read_text("utf-8").splitlines() if line.strip()]
        if len(preds) < len(rows):
            raise ValueError(f"{predictions} has {len(preds)} predictions for {len(rows)} examples")
    else:
        if not (base_url and model):
            raise ValueError("either --predictions or --base-url and --model are required")
        with ThreadPoolExecutor(max_workers=workers) as pool:
            preds = list(pool.map(lambda r: generate(base_url, model, r["messages"][:-1], api_key), rows))
    scored = [score(r["messages"], p, r.get("meta") or {}) for r, p in zip(rows, preds, strict=False)]
    metrics = aggregate(scored)
    base_metrics = json.loads(baseline.read_text("utf-8"))["metrics"] if baseline else None
    failures = gates(metrics, gates_config, base_metrics)
    report = {"dataset": str(dataset), "model": model or "predictions", "metrics": metrics, "gates_passed": not failures,
              "failures": failures}
    if out:
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        out.with_suffix(".md").write_text(markdown(report), encoding="utf-8")
        with out.with_suffix(".predictions.jsonl").open("w", encoding="utf-8") as handle:
            for row, pred in zip(rows, preds, strict=False):
                handle.write(json.dumps({"meta": row.get("meta"), "prediction": pred}, ensure_ascii=False) + "\n")
    return report


def markdown(report: dict[str, Any]) -> str:
    m = report["metrics"]
    lines = [f"# Evaluation — {report['model']}", "", f"Dataset: `{report['dataset']}` · {m['n']} examples "
             f"({', '.join(f'{k}: {v}' for k, v in m['n_by_kind'].items())})", "", "| Metric | Value |", "|---|---|"]
    for key in ("citation_validity", "citation_coverage", "false_abstention", "unsupported_numbers",
                "abstention_accuracy", "safety_accuracy", "language_fidelity"):
        value = m.get(key)
        lines.append(f"| {key} | {'—' if value is None else f'{value:.3f}'} |")
    lines += ["", "**Release gates: " + ("PASSED**" if report["gates_passed"] else "FAILED**")]
    lines += [f"- {f}" for f in report["failures"]]
    return "\n".join(lines) + "\n"
