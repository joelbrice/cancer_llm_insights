"""Loader contracts shared by every file format."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class Block:
    """A contiguous piece of document text with its structural location."""

    text: str
    section: str | None = None
    page: int | None = None


@dataclass(slots=True)
class LoadedDocument:
    blocks: list[Block]
    metadata: dict[str, Any] = field(default_factory=dict)
    record_key: str | None = None  # set for multi-record files (jsonl/csv/pubmed xml)
    hints: dict[str, Any] = field(default_factory=dict)  # e.g. publication types for the classifier

    @property
    def text(self) -> str:
        return "\n\n".join(b.text for b in self.blocks if b.text)


class LoaderError(RuntimeError):
    pass


_REFERENCE_HEADINGS = re.compile(
    r"^\s*(?:\d+\.?\s*)?(references|bibliography|literature cited|works cited|références|bibliographie|"
    r"referencias|bibliografía|referências|bibliografia|literatur(?:verzeichnis)?|quellen)\s*:?\s*$",
    re.IGNORECASE,
)
_BACKMATTER_HEADINGS = re.compile(
    r"^\s*(?:\d+\.?\s*)?(acknowledg(e)?ments?|conflicts? of interest|competing interests|funding|"
    r"author contributions|remerciements|conflits d'intérêts|agradecimientos|agradecimentos|danksagung)\s*:?\s*$",
    re.IGNORECASE,
)


def is_reference_heading(line: str) -> bool:
    return bool(_REFERENCE_HEADINGS.match(line))


def is_backmatter_heading(line: str) -> bool:
    return bool(_BACKMATTER_HEADINGS.match(line))


def decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1", errors="replace")
