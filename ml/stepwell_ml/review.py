"""Clinical review gate. Training refuses a dataset that a clinician has not signed off.

1. `stepwell-ml review-sample` writes a random sample (≥5 %, at least 30) as a readable Markdown worksheet.
2. A clinician reviews it (accuracy, citations, tone, safety, language) and records the outcome with
   `stepwell-ml review-approve`.
3. The approval is bound to the SHA-256 of the exact training file: any later change invalidates it.
"""

from __future__ import annotations

import json
import math
import random
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from stepwell_ml.data import passages, read_jsonl, sha256_file


def review_path(train_file: Path) -> Path:
    return train_file.with_suffix(".review.json")


def sample(train_file: Path, out: Path, fraction: float = 0.05, minimum: int = 30, seed: int = 7) -> int:
    rows = [row for _, row, err in read_jsonl(train_file) if row is not None and not err]
    n = min(len(rows), max(minimum, math.ceil(len(rows) * fraction)))
    picked = random.Random(seed).sample(rows, n) if n < len(rows) else rows
    lines = [f"# Clinical review worksheet — {train_file.name}", "",
             f"Sample: {n} of {len(rows)} examples (seed {seed}). For each example check: factual accuracy against "
             "the passages, every claim cited, safe and non-judgemental tone, no diagnosis or treatment advice, "
             "answer in the requested language. Record problems with the example number.", ""]
    for i, row in enumerate(picked, start=1):
        meta = row.get("meta", {})
        user = row["messages"][-2]["content"]
        question = user.rsplit("Question:", 1)[-1].strip()
        lines += [f"## {i}. {meta.get('kind')} · {meta.get('language')} · {meta.get('topic') or '—'}", "",
                  f"**Question:** {question}", ""]
        for n_, text in sorted(passages(user).items()):
            lines.append(f"> [{n_}] {' '.join(text.split())[:400]}…")
        lines += ["", "**Answer:**", "", row["messages"][-1]["content"], "", "- [ ] OK   - [ ] Problem: ______", ""]
    out.write_text("\n".join(lines), encoding="utf-8")
    return n


def approve(train_file: Path, reviewer: str, sample_size: int, notes: str = "", approved: bool = True) -> dict[str, Any]:
    record = {
        "file": train_file.name, "sha256": sha256_file(train_file), "approved": approved, "reviewer": reviewer,
        "sample_size": sample_size, "notes": notes, "reviewed_at": datetime.now(UTC).isoformat(),
    }
    review_path(train_file).write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record


def check(train_file: Path) -> tuple[bool, str]:
    path = review_path(train_file)
    if not path.exists():
        return False, f"no clinical review found ({path.name}); run `stepwell-ml review-sample` then `review-approve`"
    record = json.loads(path.read_text("utf-8"))
    if not record.get("approved"):
        return False, f"review of {train_file.name} was not approved: {record.get('notes') or 'see reviewer notes'}"
    if record.get("sha256") != sha256_file(train_file):
        return False, f"{train_file.name} changed after review; it must be reviewed again"
    return True, f"approved by {record.get('reviewer')} on {str(record.get('reviewed_at', ''))[:10]}"
