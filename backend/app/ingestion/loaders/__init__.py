"""Format dispatch for document loaders."""

from __future__ import annotations

from collections.abc import Callable

from app.ingestion.loaders.base import Block, LoadedDocument, LoaderError
from app.ingestion.loaders.documents import load_docx, load_html, load_pdf, load_text
from app.ingestion.loaders.structured import load_csv, load_json, load_jsonl, load_xml

Loader = Callable[[bytes, str], list[LoadedDocument]]

LOADERS: dict[str, Loader] = {
    "pdf": load_pdf,
    "html": load_html,
    "htm": load_html,
    "xhtml": load_html,
    "md": load_text,
    "markdown": load_text,
    "txt": load_text,
    "text": load_text,
    "docx": load_docx,
    "json": load_json,
    "jsonl": load_jsonl,
    "ndjson": load_jsonl,
    "csv": load_csv,
    "tsv": load_csv,
    "xml": load_xml,
    "nxml": load_xml,
}


def sniff_extension(data: bytes, fallback: str) -> str:
    head = data[:512].lstrip()
    if head.startswith(b"%PDF"):
        return "pdf"
    if head[:2] == b"PK" and fallback in ("docx", ""):
        return "docx"
    lowered = head.lower()
    if lowered.startswith((b"<!doctype html", b"<html")):
        return "html"
    if lowered.startswith(b"<?xml") or lowered.startswith(b"<pubmedarticleset") or lowered.startswith(b"<article"):
        return "xml"
    return fallback


def load_bytes(data: bytes, path: str, extension: str) -> list[LoadedDocument]:
    ext = sniff_extension(data, extension.lower())
    loader = LOADERS.get(ext)
    if loader is None:
        raise LoaderError(f"unsupported file type: .{extension}")
    return loader(data, path)


__all__ = ["LOADERS", "Block", "LoadedDocument", "LoaderError", "load_bytes"]
