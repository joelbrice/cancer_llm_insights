"""Scan a data source (local folder or bucket) and read files through a unified fsspec interface."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import posixpath
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import fsspec
import yaml

from app.datasources.registry import SourceSpec
from app.datasources.uri import ParsedURI
from app.settings import Settings

log = logging.getLogger(__name__)

SIDECAR_SUFFIXES = (".meta.json", ".meta.yaml", ".meta.yml")
MANIFEST_NAMES = ("manifest.jsonl", "_manifest.jsonl", "manifest.csv")


@dataclass(slots=True)
class RemoteFile:
    path: str  # relative to the source root, POSIX separators
    location: str  # full path/URL understood by the filesystem
    size: int
    fingerprint: str  # cheap change detector (etag / mtime+size / generation)
    metadata: dict[str, Any] = field(default_factory=dict)  # from manifest + sidecar
    inline_text: str | None = None  # for manifest records that embed their text

    def __post_init__(self) -> None:
        self.fingerprint = compact_fingerprint(self.fingerprint)

    @property
    def extension(self) -> str:
        name = self.path.rsplit("/", 1)[-1].lower()
        return name.rsplit(".", 1)[-1] if "." in name else ""


@lru_cache(maxsize=256)
def _glob_regex(pattern: str) -> re.Pattern[str]:
    i, out = 0, []
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    return re.compile("^" + "".join(out) + "$", re.IGNORECASE)


def matches(path: str, include: list[str], exclude: list[str]) -> bool:
    if any(_glob_regex(p).match(path) for p in exclude):
        return False
    return any(_glob_regex(p).match(path) for p in include)


FINGERPRINT_MAX = 128  # documents.file_fingerprint


def compact_fingerprint(raw: str) -> str:
    """Fingerprints with sidecar or manifest metadata (or a long URL) can exceed the database column, which
    PostgreSQL enforces: those are stored as their SHA-256, so any change to the parts is still detected."""
    if len(raw) <= FINGERPRINT_MAX:
        return raw
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _fingerprint(info: dict[str, Any]) -> str:
    for key in ("ETag", "etag", "md5Hash", "content_md5", "generation", "crc32c"):
        value = info.get(key)
        if value:
            return f"{key}:{str(value).strip(chr(34))}"
    mtime = info.get("mtime") or info.get("LastModified") or info.get("last_modified") or info.get("updated")
    if hasattr(mtime, "timestamp"):
        mtime = mtime.timestamp()
    return f"size:{info.get('size')}|mtime:{mtime}"


class SourceScanner:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.max_bytes = settings.max_file_size_mb * 1024 * 1024

    def filesystem(self, spec: SourceSpec) -> tuple[fsspec.AbstractFileSystem, ParsedURI]:
        parsed = spec.parsed(self.settings)
        fs = fsspec.filesystem(parsed.protocol, **spec.resolved_storage_options())
        return fs, parsed

    def test(self, spec: SourceSpec, sample: int = 10) -> dict[str, Any]:
        """Connectivity check used by the admin screen: lists a sample of matching files."""
        files = []
        for i, f in enumerate(self.scan(spec)):
            if i >= sample:
                break
            files.append({"path": f.path, "size": f.size})
        return {"ok": True, "sample": files}

    def scan(self, spec: SourceSpec) -> Iterator[RemoteFile]:
        fs, parsed = self.filesystem(spec)
        if parsed.is_manifest:
            yield from self._scan_http_manifest(fs, parsed)
            return
        root = fs._strip_protocol(parsed.path) if parsed.protocol != "file" else parsed.path
        if parsed.is_local and not fs.exists(root):
            raise FileNotFoundError(f"local data folder does not exist: {root}")
        listing: dict[str, dict[str, Any]] = {}
        for full, info in fs.find(root, detail=True, withdirs=False).items():
            if info.get("type") == "directory":
                continue
            rel = posixpath.relpath(full.replace("\\", "/"), root.replace("\\", "/"))
            listing[rel] = {**info, "_full": full}

        manifest = self._load_manifests(fs, root, listing)
        for rel in sorted(listing):
            info = listing[rel]
            if not matches(rel, spec.include, spec.exclude):
                continue
            size = int(info.get("size") or 0)
            if size > self.max_bytes:
                log.warning("skipping %s (%.1f MB > MAX_FILE_SIZE_MB)", rel, size / 1e6)
                continue
            metadata = dict(manifest.get(rel, {}))
            fingerprint = _fingerprint(info)
            for suffix in SIDECAR_SUFFIXES:
                sidecar = listing.get(rel + suffix)
                if sidecar:
                    metadata.update(self._read_structured(fs, sidecar["_full"], suffix))
                    fingerprint += "|meta:" + _fingerprint(sidecar)
            if rel in manifest:
                fingerprint += "|manifest:" + json.dumps(manifest[rel], sort_keys=True, default=str)
            yield RemoteFile(path=rel, location=info["_full"], size=size, fingerprint=fingerprint, metadata=metadata)

    def read_bytes(self, spec: SourceSpec, file: RemoteFile) -> bytes:
        if file.inline_text is not None:
            return file.inline_text.encode("utf-8")
        fs, _ = self.filesystem(spec)
        with fs.open(file.location, "rb") as handle:
            return handle.read(self.max_bytes + 1)[: self.max_bytes]

    # ── helpers ──────────────────────────────────────────────────────────────
    def _read_structured(self, fs: fsspec.AbstractFileSystem, location: str, suffix: str) -> dict[str, Any]:
        try:
            with fs.open(location, "rb") as handle:
                raw = handle.read().decode("utf-8")
            data = json.loads(raw) if suffix.endswith("json") else yaml.safe_load(raw)
            return data if isinstance(data, dict) else {}
        except Exception as exc:
            log.warning("cannot read metadata sidecar %s: %s", location, exc)
            return {}

    def _load_manifests(self, fs, root: str, listing: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for name in MANIFEST_NAMES:
            for rel, info in listing.items():
                if posixpath.basename(rel) != name:
                    continue
                base = posixpath.dirname(rel)
                for record in self._read_records(fs, info["_full"], name):
                    path = str(record.pop("path", "") or record.pop("file", "")).lstrip("./")
                    if path:
                        out[posixpath.normpath(posixpath.join(base, path)) if base else path] = record
        return out

    def _read_records(self, fs, location: str, name: str) -> Iterator[dict[str, Any]]:
        try:
            with fs.open(location, "rb") as handle:
                text = handle.read().decode("utf-8-sig")
        except Exception as exc:
            log.warning("cannot read manifest %s: %s", location, exc)
            return
        if name.endswith(".csv"):
            yield from (dict(row) for row in csv.DictReader(io.StringIO(text)))
        else:
            for n, line in enumerate(text.splitlines(), 1):
                if line.strip():
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        log.warning("manifest %s line %d is not valid JSON", location, n)

    def _scan_http_manifest(self, fs, parsed: ParsedURI) -> Iterator[RemoteFile]:
        """HTTP(S) manifest: each record has `url` (remote document) or `text` (inline content)."""
        name = parsed.path.rsplit("/", 1)[-1].split("?", 1)[0].lower()
        kind = "manifest.csv" if name.endswith(".csv") else "manifest.jsonl"
        if name.endswith(".json"):
            with fs.open(parsed.path, "rb") as handle:
                data = json.loads(handle.read().decode("utf-8"))
            records = data if isinstance(data, list) else data.get("documents", [])
        else:
            records = list(self._read_records(fs, parsed.path, kind))
        for i, record in enumerate(records):
            record = dict(record)
            url, text = record.pop("url", None), record.pop("text", None)
            key = str(record.pop("path", None) or record.get("id") or url or f"record-{i}")
            if url:
                record.setdefault("url", url)
                fingerprint = str(record.get("etag") or record.get("updated") or record.get("version") or url)
                ext_hint = record.pop("format", None)
                path = key if "." in key.rsplit("/", 1)[-1] or not ext_hint else f"{key}.{ext_hint}"
                yield RemoteFile(path=path, location=url, size=0, fingerprint=fingerprint, metadata=record)
            elif text:
                from app.core.text import sha256_text

                path = key if key.endswith((".txt", ".md")) else f"{key}.txt"
                yield RemoteFile(path=path, location=parsed.path, size=len(text), fingerprint=sha256_text(text)[:32],
                                 metadata=record, inline_text=text)
