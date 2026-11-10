"""URI parsing, environment-variable interpolation and credential redaction for data sources."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

_ENV_REF = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")

PROTOCOLS: dict[str, tuple[str, str]] = {
    # scheme → (fsspec protocol, kind shown in the UI)
    "file": ("file", "local"),
    "local": ("file", "local"),
    "s3": ("s3", "s3"),
    "s3a": ("s3", "s3"),
    "gs": ("gcs", "gcs"),
    "gcs": ("gcs", "gcs"),
    "az": ("az", "azure"),
    "abfs": ("abfs", "azure"),
    "abfss": ("abfs", "azure"),
    "http": ("http", "http"),
    "https": ("https", "http"),
    "memory": ("memory", "memory"),
}

EXTRA_FOR_PROTOCOL = {"s3": "s3", "gcs": "gcs", "az": "azure", "abfs": "azure"}


class MissingEnvironmentVariable(ValueError):
    pass


def interpolate_env(value: Any, environ: dict[str, str] | None = None) -> Any:
    """Recursively resolve ${VAR} / ${VAR:-default} references (used for storage credentials)."""
    env = os.environ if environ is None else environ
    if isinstance(value, str):

        def repl(match: re.Match[str]) -> str:
            name, default = match.group(1), match.group(2)
            if name in env and env[name] != "":
                return env[name]
            if default is not None:
                return default
            raise MissingEnvironmentVariable(f"environment variable {name} is not set")

        return _ENV_REF.sub(repl, value)
    if isinstance(value, dict):
        return {k: interpolate_env(v, env) for k, v in value.items()}
    if isinstance(value, list):
        return [interpolate_env(v, env) for v in value]
    return value


def drop_empty(value: Any) -> Any:
    """Remove keys whose value became empty after interpolation (e.g. optional endpoint_url)."""
    if isinstance(value, dict):
        return {k: drop_empty(v) for k, v in value.items() if v not in ("", None, {}, [])}
    return value


@dataclass(frozen=True, slots=True)
class ParsedURI:
    raw: str
    protocol: str  # fsspec protocol
    kind: str  # local | s3 | gcs | azure | http | memory
    path: str  # path/URL passed to fsspec
    is_manifest: bool  # HTTP(S) manifest listing remote documents

    @property
    def is_local(self) -> bool:
        return self.kind == "local"


def parse_source_uri(uri: str, project_root: Path) -> ParsedURI:
    uri = uri.strip()
    if not uri:
        raise ValueError("empty data source URI")
    scheme = uri.split("://", 1)[0].lower() if "://" in uri else ""
    if not scheme:
        path = Path(uri).expanduser()
        path = path if path.is_absolute() else (project_root / path)
        return ParsedURI(uri, "file", "local", str(path.resolve()), False)
    if scheme not in PROTOCOLS:
        raise ValueError(f"unsupported URI scheme '{scheme}://' (supported: {', '.join(sorted(PROTOCOLS))})")
    protocol, kind = PROTOCOLS[scheme]
    if protocol == "file":
        rest = uri.split("://", 1)[1]
        path = Path(rest).expanduser()
        path = path if path.is_absolute() else (project_root / path)
        return ParsedURI(uri, "file", "local", str(path.resolve()), False)
    if kind == "http":
        lowered = urlsplit(uri).path.lower()
        is_manifest = lowered.endswith((".jsonl", ".json", ".csv"))
        return ParsedURI(uri, protocol, kind, uri, is_manifest)
    return ParsedURI(uri, protocol, kind, uri.rstrip("/"), False)


def redact_uri(uri: str) -> str:
    """Strip user-info and sensitive query parameters (SAS tokens, signatures) for display/logging."""
    if "://" not in uri:
        return uri
    parts = urlsplit(uri)
    netloc = parts.netloc.rsplit("@", 1)[-1]
    query = parts.query
    if query:
        safe = []
        for pair in query.split("&"):
            key = pair.split("=", 1)[0].lower()
            sensitive = key in {"sig", "signature", "token", "key", "secret", "x-amz-signature", "x-amz-credential",
                                "x-goog-signature", "access_token", "sv", "se", "sp"}
            safe.append(f"{pair.split('=', 1)[0]}=***" if sensitive else pair)
        query = "&".join(safe)
    return urlunsplit((parts.scheme, netloc, parts.path, query, parts.fragment))


def redact_options(options: dict[str, Any] | None) -> dict[str, Any]:
    """Show which storage options are configured without leaking values."""
    if not options:
        return {}
    out: dict[str, Any] = {}
    for key, value in options.items():
        if isinstance(value, dict):
            out[key] = redact_options(value)
        elif isinstance(value, str) and _ENV_REF.search(value):
            out[key] = value  # references like ${AWS_SECRET_ACCESS_KEY} are safe to show
        elif any(s in key.lower() for s in ("secret", "key", "token", "password", "credential", "sas")):
            out[key] = "***"
        else:
            out[key] = value
    return out
