"""Structure-aware chunking with provenance (section, pages, character offsets).

Sentences are packed greedily up to `chunk_size` tokens; a new chunk starts at section boundaries
(when the current chunk is already reasonably full) and consecutive chunks share `overlap` tokens of
trailing sentences so that claims spanning a boundary remain retrievable.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.text import content_fingerprint, estimate_tokens, sentence_spans, words
from app.ingestion.loaders.base import Block


@dataclass(slots=True)
class Chunk:
    ordinal: int
    text: str
    section: str | None
    page_start: int | None
    page_end: int | None
    char_start: int
    char_end: int
    token_count: int
    content_hash: str


@dataclass(slots=True)
class _Unit:
    start: int
    end: int
    text: str
    tokens: int
    section: str | None
    page: int | None


_REFERENCE_LINE = re.compile(r"(et al\.|doi:|\(\d{4}\)|\b\d{4};\d+|https?://)", re.I)


def assemble(blocks: list[Block]) -> tuple[str, list[tuple[int, int, Block]]]:
    """Concatenate blocks into one document text, remembering each block's character span."""
    parts, spans, cursor = [], [], 0
    for block in blocks:
        text = block.text.strip()
        if not text:
            continue
        if parts:
            parts.append("\n\n")
            cursor += 2
        spans.append((cursor, cursor + len(text), block))
        parts.append(text)
        cursor += len(text)
    return "".join(parts), spans


def _units(doc_text: str, spans: list[tuple[int, int, Block]], max_tokens: int) -> list[_Unit]:
    units: list[_Unit] = []
    for start, end, block in spans:
        for sent in sentence_spans(doc_text[start:end]):
            s_start, s_end = start + sent.start, start + sent.end
            tokens = estimate_tokens(sent.text)
            if tokens <= max_tokens:
                units.append(_Unit(s_start, s_end, sent.text, tokens, block.section, block.page))
                continue
            # very long "sentence" (tables, lists without punctuation): hard split on words
            cursor = s_start
            piece_words: list[str] = []
            for match in re.finditer(r"\S+", sent.text):
                piece_words.append(match.group(0))
                if estimate_tokens(" ".join(piece_words)) >= max_tokens * 0.8:
                    piece_end = s_start + match.end()
                    units.append(_Unit(cursor, piece_end, doc_text[cursor:piece_end], max_tokens, block.section,
                                       block.page))
                    cursor, piece_words = piece_end + 1, []
            if cursor < s_end:
                units.append(_Unit(cursor, s_end, doc_text[cursor:s_end], estimate_tokens(doc_text[cursor:s_end]),
                                   block.section, block.page))
    return units


def _is_low_information(text: str) -> bool:
    tokens = words(text)
    if len(tokens) < 8:
        return True
    alpha = sum(1 for t in tokens if t.isalpha())
    if alpha / len(tokens) < 0.5:
        return True  # mostly numbers: table residue
    return len(_REFERENCE_LINE.findall(text)) >= max(3, len(tokens) // 12)  # reference-list residue


def chunk_blocks(blocks: list[Block], chunk_size: int = 300, overlap: int = 45) -> tuple[str, list[Chunk]]:
    doc_text, spans = assemble(blocks)
    units = _units(doc_text, spans, chunk_size)
    chunks: list[Chunk] = []
    current: list[_Unit] = []
    current_tokens = 0

    def emit() -> None:
        nonlocal current, current_tokens
        if not current:
            return
        start, end = current[0].start, current[-1].end
        text = doc_text[start:end]
        if not _is_low_information(text):
            pages = [u.page for u in current if u.page is not None]
            chunks.append(Chunk(
                ordinal=len(chunks), text=text, section=current[0].section,
                page_start=min(pages) if pages else None, page_end=max(pages) if pages else None,
                char_start=start, char_end=end, token_count=current_tokens,
                content_hash=content_fingerprint(text),
            ))
        # carry overlap: trailing sentences up to `overlap` tokens (same section only)
        carried, carried_tokens = [], 0
        for unit in reversed(current):
            if carried_tokens + unit.tokens > overlap or unit.section != current[-1].section:
                break
            carried.insert(0, unit)
            carried_tokens += unit.tokens
        if len(carried) == len(current):
            carried, carried_tokens = [], 0  # never re-emit a whole chunk
        current, current_tokens = carried, carried_tokens

    for unit in units:
        section_changed = bool(current) and unit.section != current[-1].section
        if section_changed and current_tokens >= chunk_size * 0.35:
            emit()
            current, current_tokens = [], 0  # no overlap across sections
        elif current_tokens + unit.tokens > chunk_size:
            emit()
        current.append(unit)
        current_tokens += unit.tokens
    if current and (not chunks or current[-1].end > chunks[-1].char_end):
        emit()
    return doc_text, chunks
