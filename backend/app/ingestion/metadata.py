"""Metadata normalisation, extraction from text, and publisher credibility lookup."""

from __future__ import annotations

import re
from datetime import date
from functools import cached_property
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import yaml

from app.evidence.taxonomy import Credibility, coerce_credibility

RESOURCES = Path(__file__).resolve().parent.parent / "resources"

_DOI = re.compile(r"\b(10\.\d{4,9}/[^\s\"<>,;]+)", re.IGNORECASE)
_PMID = re.compile(r"\bPMID:?\s*(\d{6,9})\b", re.IGNORECASE)
_YEAR = re.compile(r"(?<!\d)((?:19[5-9]|20[0-4])\d)(?!\d)")

LIST_FIELDS = ("authors", "topics", "cancer_types", "audience")
KNOWN_FIELDS = {
    "id", "title", "authors", "year", "published_date", "journal", "publisher", "doi", "pmid", "pmcid", "url",
    "language", "source_type", "credibility", "topics", "cancer_types", "audience", "license", "retracted",
    "sample_size", "abstract",
}


def _as_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, str):
        return [v.strip() for v in re.split(r";|\|", value) if v.strip()]
    if isinstance(value, list | tuple | set):
        out = []
        for v in value:
            if isinstance(v, dict):  # {"name": "..."} or {"family": "..", "given": ".."}
                v = v.get("name") or " ".join(filter(None, [v.get("family"), v.get("given")]))
            if v:
                out.append(str(v).strip())
        return out
    return [str(value)]


def normalize_doi(value: str | None) -> str | None:
    if not value:
        return None
    value = str(value).strip()
    value = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", value, flags=re.I)
    match = _DOI.search(value)
    return match.group(1).rstrip(".)]") if match else None


def normalize_metadata(raw: dict[str, Any]) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    extra: dict[str, Any] = {}
    for key, value in raw.items():
        key = str(key).strip().lower()
        if value is None or value == "" or key.startswith("_"):
            continue
        if key in LIST_FIELDS:
            meta[key] = [v.lower().replace(" ", "_") if key != "authors" else v for v in _as_list(value)]
        elif key == "year":
            match = _YEAR.search(str(value))
            if match:
                meta["year"] = int(match.group(1))
        elif key == "published_date":
            meta["published_date"] = str(value)[:10]
            if "year" not in meta and (match := _YEAR.search(str(value))):
                meta["year"] = int(match.group(1))
        elif key == "doi":
            if doi := normalize_doi(str(value)):
                meta["doi"] = doi
        elif key == "pmid":
            digits = re.sub(r"\D", "", str(value))
            if digits:
                meta["pmid"] = digits
        elif key == "language":
            meta["language"] = str(value).strip().lower()[:2]
        elif key == "retracted":
            meta["retracted"] = str(value).strip().lower() in ("1", "true", "yes", "y")
        elif key == "sample_size":
            digits = re.sub(r"[^\d]", "", str(value))
            if digits:
                meta["sample_size"] = int(digits)
        elif key in KNOWN_FIELDS:
            meta[key] = value if not isinstance(value, str) else value.strip()
        else:
            extra[key] = value
    if extra:
        meta["extra"] = extra
    return meta


def extract_from_text(text: str) -> dict[str, Any]:
    """Recover identifiers from the first pages of a document when metadata is missing."""
    head = text[:6000]
    found: dict[str, Any] = {}
    if doi := normalize_doi(head):
        found["doi"] = doi
    if match := _PMID.search(head):
        found["pmid"] = match.group(1)
    years = [int(y) for y in _YEAR.findall(head[:2500]) if int(y) <= date.today().year]
    if years:
        # most recent year in the header region is usually the publication year
        found["year"] = max(years)
    return found


def guess_title(text: str, path: str) -> str:
    for line in text.split("\n")[:15]:
        line = line.strip()
        if 15 <= len(line) <= 250 and not re.match(r"^(doi|http|www\.|©|copyright|vol\.|issn)", line, re.I):
            return line.rstrip(".")
    stem = Path(path.split("#", 1)[0]).stem
    return re.sub(r"[_-]+", " ", stem).strip().capitalize() or "Untitled document"


class CredibilityRegistry:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or RESOURCES / "credibility.yaml"

    @cached_property
    def _data(self) -> tuple[dict[str, dict[str, str]], list[tuple[re.Pattern[str], Credibility]]]:
        raw = yaml.safe_load(self.path.read_text(encoding="utf-8")) if self.path.exists() else {}
        domains = {k.lower(): v for k, v in (raw.get("domains") or {}).items()}
        patterns = []
        for entry in raw.get("publishers") or []:
            cred = coerce_credibility(entry.get("credibility"))
            if cred:
                patterns.append((re.compile(entry["pattern"], re.IGNORECASE), cred))
        return domains, patterns

    def lookup(self, url: str | None = None, *names: str | None) -> tuple[Credibility | None, str | None]:
        domains, patterns = self._data
        if url:
            host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
            parts = host.split(".")
            for i in range(len(parts) - 1):
                entry = domains.get(".".join(parts[i:]))
                if entry:
                    return coerce_credibility(entry.get("credibility")), entry.get("publisher")
        for name in names:
            if not name:
                continue
            for pattern, cred in patterns:
                if pattern.search(name):
                    return cred, None
        return None, None
