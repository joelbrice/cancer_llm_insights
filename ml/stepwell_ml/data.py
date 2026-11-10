"""Fine-tuning data: validation, mixing and assistant-only tokenisation.

Input is the RAFT-style JSONL written by the API (`POST /api/v1/admin/export/sft`): one chat per line,
`{"messages": [system, user, assistant], "meta": {"kind": "grounded|abstain|safety:<rule>", "language": ...}}`.
"""

from __future__ import annotations

import glob
import hashlib
import json
import random
import re
from collections import Counter
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

KINDS = ("grounded", "abstain", "safety")
_PASSAGE_HEAD = re.compile(r"^\[(\d+)\] ", re.M)
_CITATION = re.compile(r"\[(\d{1,3})\]")
_EVIDENCE = re.compile(r"<evidence[^>]*>(.*?)</evidence>", re.S)


@dataclass(slots=True)
class Example:
    messages: list[dict[str, str]]
    meta: dict[str, Any]

    @property
    def kind(self) -> str:
        return str(self.meta.get("kind", "grounded")).split(":", 1)[0]

    @property
    def language(self) -> str:
        return str(self.meta.get("language", "en"))

    def fingerprint(self) -> str:
        return hashlib.sha256(json.dumps(self.messages, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


@dataclass
class DataReport:
    files: list[str] = field(default_factory=list)
    total: int = 0
    kept: int = 0
    duplicates: int = 0
    invalid: int = 0
    errors: list[str] = field(default_factory=list)
    by_kind: Counter = field(default_factory=Counter)
    by_language: Counter = field(default_factory=Counter)

    def as_dict(self) -> dict[str, Any]:
        return {"files": self.files, "total": self.total, "kept": self.kept, "duplicates": self.duplicates,
                "invalid": self.invalid, "errors": self.errors[:50], "by_kind": dict(self.by_kind),
                "by_language": dict(self.by_language)}


def resolve_files(patterns: Iterable[str], base: Path, latest_only: bool = True) -> list[Path]:
    """Expand globs relative to `base`. Exports are timestamped, so `latest_only` keeps the newest file."""
    found: list[Path] = []
    for pattern in patterns:
        p = Path(pattern)
        full = str(p if p.is_absolute() else base / p)
        found += [Path(f).resolve() for f in sorted(glob.glob(full))]
    found = sorted(dict.fromkeys(found))
    return found[-1:] if latest_only and found else found


def read_jsonl(path: Path) -> Iterator[tuple[int, dict[str, Any] | None, str | None]]:
    with path.open(encoding="utf-8") as handle:
        for number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                yield number, json.loads(line), None
            except json.JSONDecodeError as exc:
                yield number, None, f"invalid JSON: {exc.msg}"


def passages(user_content: str) -> dict[int, str]:
    """Numbered evidence passages contained in a user turn (`[n] Title …` blocks inside <evidence>)."""
    block = _EVIDENCE.search(user_content)
    if not block:
        return {}
    text = block.group(1)
    heads = list(_PASSAGE_HEAD.finditer(text))
    out: dict[int, str] = {}
    for i, head in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out[int(head.group(1))] = text[head.end():end]
    return out


def citations(text: str) -> list[int]:
    return [int(n) for n in _CITATION.findall(text)]


def validate(row: Any) -> list[str]:
    """Structural and grounding checks. An example with errors is never trained on."""
    if not isinstance(row, dict) or not isinstance(row.get("messages"), list):
        return ["missing messages"]
    messages = row["messages"]
    roles = [m.get("role") if isinstance(m, dict) else None for m in messages]
    errors: list[str] = []
    if len(messages) < 2 or roles[-1] != "assistant" or roles[-2] != "user":
        errors.append(f"roles must end with user, assistant (got {roles})")
    if any(r not in ("system", "user", "assistant") for r in roles):
        errors.append("unknown role")
    if any(not isinstance(m, dict) or not isinstance(m.get("content"), str) or not m["content"].strip()
           for m in messages):
        errors.append("empty content")
    if errors:
        return errors
    meta = row.get("meta") or {}
    kind = str(meta.get("kind", "grounded")).split(":", 1)[0]
    if kind not in KINDS:
        errors.append(f"unknown kind {kind!r}")
    available = passages(messages[-2]["content"])
    cited = citations(messages[-1]["content"])
    if kind == "grounded":
        if not cited:
            errors.append("grounded answer without citations")
        bad = sorted({n for n in cited if n not in available})
        if bad:
            errors.append(f"citations {bad} not among passages {sorted(available)}")
    elif cited:
        errors.append(f"{kind} answer must not cite passages")
    return errors


def load_examples(files: list[Path], kind_weights: dict[str, float] | None = None, languages: list[str] | None = None,
                  seed: int = 13) -> tuple[list[Example], DataReport]:
    """Validate, de-duplicate, filter and re-weight examples (weights > 1 upsample, < 1 subsample)."""
    rng = random.Random(seed)
    report = DataReport(files=[str(f) for f in files])
    seen: set[str] = set()
    out: list[Example] = []
    for path in files:
        for number, row, parse_error in read_jsonl(path):
            report.total += 1
            errors = [parse_error] if parse_error else validate(row)
            if errors:
                report.invalid += 1
                report.errors.append(f"{path.name}:{number}: {'; '.join(errors)}")
                continue
            example = Example(messages=row["messages"], meta=row.get("meta") or {})
            if languages and example.language not in languages:
                continue
            fp = example.fingerprint()
            if fp in seen:
                report.duplicates += 1
                continue
            seen.add(fp)
            weight = (kind_weights or {}).get(example.kind, 1.0)
            copies = int(weight) + (1 if rng.random() < weight - int(weight) else 0)
            for _ in range(copies):
                out.append(example)
                report.by_kind[example.kind] += 1
                report.by_language[example.language] += 1
    rng.shuffle(out)
    report.kept = len(out)
    return out, report


class TemplateMismatch(ValueError):
    """The tokenizer's chat template does not render the prompt as a prefix of the full conversation."""


def _ids(rendered: Any) -> list[int]:
    if isinstance(rendered, dict) or hasattr(rendered, "keys"):
        rendered = rendered["input_ids"]
    return list(rendered)


def build_features(tokenizer: Any, messages: list[dict[str, str]], max_length: int) -> dict[str, list[int]] | None:
    """Tokenise with the model's own chat template and mask everything but the assistant reply (labels = -100),
    so the model learns to *answer* and to stop (end-of-turn token), not to reproduce prompts or evidence.
    Returns None when the example is longer than `max_length`: it is dropped, never truncated, because
    truncating evidence would teach the model to cite passages it cannot see."""
    prompt = _ids(tokenizer.apply_chat_template(messages[:-1], add_generation_prompt=True, tokenize=True))
    full = _ids(tokenizer.apply_chat_template(messages, tokenize=True))
    if full[: len(prompt)] != prompt:
        raise TemplateMismatch("chat template is not prefix-stable")
    if len(full) > max_length:
        return None
    return {"input_ids": full, "attention_mask": [1] * len(full), "labels": [-100] * len(prompt) + full[len(prompt):]}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()
