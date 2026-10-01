"""Loaders for structured sources: JSON/JSONL/CSV records and JATS / PubMed XML."""

from __future__ import annotations

import csv
import io
import json
from typing import Any

from app.core.text import normalize_whitespace
from app.ingestion.loaders.base import Block, LoadedDocument, LoaderError, decode_text, is_reference_heading

TEXT_FIELDS = ("text", "content", "body", "full_text", "fulltext", "article")
ABSTRACT_FIELDS = ("abstract", "summary", "description")
KEY_FIELDS = ("id", "doc_id", "document_id", "pmid", "doi", "url", "slug")


def _record_to_document(record: dict[str, Any], fallback_key: str) -> LoadedDocument | None:
    record = {str(k).strip().lower(): v for k, v in record.items() if v not in (None, "")}
    body = next((record.pop(f) for f in TEXT_FIELDS if f in record), None)
    abstract = next((record.pop(f) for f in ABSTRACT_FIELDS if f in record), None)
    blocks: list[Block] = []
    if abstract:
        blocks.append(Block(normalize_whitespace(str(abstract)), "Abstract"))
    if body:
        if isinstance(body, list):  # [{"section": "...", "text": "..."}] or ["para", ...]
            for part in body:
                if isinstance(part, dict):
                    blocks.append(Block(normalize_whitespace(str(part.get("text", ""))), part.get("section"),
                                        part.get("page")))
                else:
                    blocks.append(Block(normalize_whitespace(str(part))))
        else:
            blocks.extend(Block(p) for p in normalize_whitespace(str(body)).split("\n\n") if p.strip())
    blocks = [b for b in blocks if b.text]
    if not blocks:
        return None
    key = next((str(record[f]) for f in KEY_FIELDS if f in record), fallback_key)
    for list_field in ("authors", "topics", "cancer_types", "audience", "publication_types"):
        value = record.get(list_field)
        if isinstance(value, str):
            record[list_field] = [v.strip() for v in value.replace("|", ";").split(";") if v.strip()]
    hints = {}
    if record.get("publication_types"):
        hints["publication_types"] = record.pop("publication_types")
    return LoadedDocument(blocks=blocks, metadata=record, record_key=key, hints=hints)


def load_jsonl(data: bytes, path: str) -> list[LoadedDocument]:
    docs = []
    for n, line in enumerate(decode_text(data).splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise LoaderError(f"line {n}: invalid JSON ({exc.msg})") from exc
        if isinstance(record, dict) and (doc := _record_to_document(record, f"line-{n}")):
            docs.append(doc)
    if not docs:
        raise LoaderError("no records with text (expected a 'text', 'content', 'body' or 'abstract' field)")
    return docs


def load_json(data: bytes, path: str) -> list[LoadedDocument]:
    try:
        payload = json.loads(decode_text(data))
    except json.JSONDecodeError as exc:
        raise LoaderError(f"invalid JSON: {exc.msg}") from exc
    if isinstance(payload, dict):
        records = payload.get("documents") or payload.get("records") or payload.get("items") or [payload]
    elif isinstance(payload, list):
        records = payload
    else:
        raise LoaderError("unsupported JSON structure")
    docs = [d for i, r in enumerate(records) if isinstance(r, dict) and (d := _record_to_document(r, f"item-{i}"))]
    if not docs:
        raise LoaderError("no records with text")
    if len(docs) == 1 and len(records) == 1:
        docs[0].record_key = None  # single document file: path is the identity
    return docs


def load_csv(data: bytes, path: str) -> list[LoadedDocument]:
    text = decode_text(data)
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    docs = [d for i, row in enumerate(reader, 2) if (d := _record_to_document(dict(row), f"row-{i}"))]
    if not docs:
        raise LoaderError("no rows with a text/abstract/content/body column")
    return docs


# ── XML: JATS (PMC full text) and PubMed (MEDLINE citations with abstracts) ───────────────────────
def load_xml(data: bytes, path: str) -> list[LoadedDocument]:
    from lxml import etree

    try:
        parser = etree.XMLParser(recover=True, resolve_entities=False, no_network=True, huge_tree=False)
        root = etree.fromstring(data, parser=parser)
    except Exception as exc:
        raise LoaderError(f"invalid XML: {exc}") from exc
    if root is None:
        raise LoaderError("empty XML")
    tag = etree.QName(root).localname
    if tag in ("PubmedArticleSet", "PubmedArticle", "MedlineCitation"):
        return _pubmed(root)
    if tag in ("article", "pmc-articleset") or root.find(".//{*}article-meta") is not None:
        articles = [root] if tag == "article" else root.findall(".//{*}article")
        docs = [d for a in articles if (d := _jats(a))]
        if docs:
            return docs
    text = normalize_whitespace(" ".join(root.itertext()))
    if not text:
        raise LoaderError("XML has no text")
    return [LoadedDocument(blocks=[Block(text)])]


def _t(el) -> str:
    return normalize_whitespace(" ".join(el.itertext())) if el is not None else ""


def _jats(article) -> LoadedDocument | None:
    meta: dict[str, Any] = {}
    hints: dict[str, Any] = {}
    am = article.find(".//{*}article-meta")
    if article.get("article-type"):
        hints["jats_article_type"] = article.get("article-type")
    if am is not None:
        meta["title"] = _t(am.find(".//{*}article-title"))
        authors = []
        for contrib in am.findall(".//{*}contrib[@contrib-type='author']"):
            surname, given = _t(contrib.find(".//{*}surname")), _t(contrib.find(".//{*}given-names"))
            if surname:
                authors.append(f"{surname} {given}".strip())
        meta["authors"] = authors
        for aid in am.findall(".//{*}article-id"):
            kind = (aid.get("pub-id-type") or "").lower()
            if kind in ("doi", "pmid"):
                meta[kind] = _t(aid)
            elif kind in ("pmc", "pmcid"):
                meta["pmcid"] = _t(aid)
        year = am.find(".//{*}pub-date/{*}year")
        if year is not None and _t(year).isdigit():
            meta["year"] = int(_t(year))
        subjects = [_t(s) for s in am.findall(".//{*}subj-group[@subj-group-type='heading']/{*}subject")]
        if subjects:
            hints["jats_subjects"] = subjects
        if (lic := am.find(".//{*}license")) is not None:
            meta["license"] = lic.get("{http://www.w3.org/1999/xlink}href") or _t(lic)[:120]
    journal = article.find(".//{*}journal-title")
    if journal is not None:
        meta["journal"] = _t(journal)
    if article.get("{http://www.w3.org/XML/1998/namespace}lang"):
        meta["language"] = article.get("{http://www.w3.org/XML/1998/namespace}lang")[:2]

    blocks: list[Block] = []
    for abstract in article.findall(".//{*}article-meta/{*}abstract"):
        for p in abstract.iter("{*}p"):
            section = p.getparent().find("{*}title") if p.getparent() is not None else None
            label = _t(section) if section is not None else "Abstract"
            if text := _t(p):
                blocks.append(Block(text, f"Abstract — {label}" if label != "Abstract" else "Abstract"))
    body = article.find(".//{*}body")
    if body is not None:
        for sec in body.iter("{*}sec"):
            title = _t(sec.find("{*}title"))
            if is_reference_heading(title):
                continue
            for p in sec.findall("{*}p"):
                if text := _t(p):
                    blocks.append(Block(text, title or None))
    if not blocks:
        return None
    return LoadedDocument(blocks=blocks, metadata={k: v for k, v in meta.items() if v}, hints=hints,
                          record_key=meta.get("pmid") or meta.get("doi"))


def _pubmed(root) -> list[LoadedDocument]:
    docs = []
    articles = root.findall(".//{*}PubmedArticle") or [root]
    for art in articles:
        citation = art.find(".//{*}MedlineCitation") if art.tag != "MedlineCitation" else art
        if citation is None:
            continue
        article = citation.find(".//{*}Article")
        if article is None:
            continue
        meta: dict[str, Any] = {"title": _t(article.find("{*}ArticleTitle"))}
        pmid = citation.find("{*}PMID")
        if pmid is not None:
            meta["pmid"] = _t(pmid)
        for eid in article.findall("{*}ELocationID"):
            if (eid.get("EIdType") or "").lower() == "doi":
                meta["doi"] = _t(eid)
        for aid in art.findall(".//{*}ArticleIdList/{*}ArticleId"):
            if (aid.get("IdType") or "").lower() == "doi" and "doi" not in meta:
                meta["doi"] = _t(aid)
            if (aid.get("IdType") or "").lower() == "pmc":
                meta["pmcid"] = _t(aid)
        meta["journal"] = _t(article.find("{*}Journal/{*}Title"))
        year = article.find(".//{*}JournalIssue/{*}PubDate/{*}Year")
        medline_date = article.find(".//{*}JournalIssue/{*}PubDate/{*}MedlineDate")
        if year is not None and _t(year).isdigit():
            meta["year"] = int(_t(year))
        elif medline_date is not None and _t(medline_date)[:4].isdigit():
            meta["year"] = int(_t(medline_date)[:4])
        authors = []
        for author in article.findall(".//{*}AuthorList/{*}Author"):
            last, initials = _t(author.find("{*}LastName")), _t(author.find("{*}Initials"))
            if last:
                authors.append(f"{last} {initials}".strip())
            elif (coll := author.find("{*}CollectiveName")) is not None:
                authors.append(_t(coll))
        meta["authors"] = authors
        lang = article.find("{*}Language")
        if lang is not None:
            meta["language"] = {"eng": "en", "fre": "fr", "spa": "es", "por": "pt", "ger": "de"}.get(_t(lang), "en")
        pub_types = [_t(p) for p in article.findall(".//{*}PublicationTypeList/{*}PublicationType")]
        mesh = [_t(m.find("{*}DescriptorName")) for m in citation.findall(".//{*}MeshHeadingList/{*}MeshHeading")]
        blocks = []
        for abstract_text in article.findall(".//{*}Abstract/{*}AbstractText"):
            label = abstract_text.get("Label")
            if text := _t(abstract_text):
                blocks.append(Block(text, f"Abstract — {label.title()}" if label else "Abstract"))
        if not blocks:
            continue  # citation without abstract carries no evidence text
        retracted = any("retract" in p.lower() for p in pub_types)
        if retracted:
            meta["retracted"] = True
        docs.append(LoadedDocument(blocks=blocks, metadata={k: v for k, v in meta.items() if v},
                                   record_key=meta.get("pmid"),
                                   hints={"publication_types": pub_types, "mesh": mesh}))
    if not docs:
        raise LoaderError("PubMed XML contains no articles with abstracts")
    return docs
