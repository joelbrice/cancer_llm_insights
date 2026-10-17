"""Evidence-graded insight generation and serving.

For every topic × language:
  retrieve (topic question + expert queries) → sufficiency check → synthesise (LLM JSON or extractive)
  → claim-level verification (unsupported points are dropped) → evidence grading → versioned storage.
Insights regenerate only when their evidence fingerprint (sources, model, prompt version) changes.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import cached_property
from pathlib import Path
from typing import Any

import numpy as np
import yaml
from sqlalchemy import func, select

from app.core.text import fold_accents, normalize_arabic
from app.db.base import Database
from app.db.models import InsightDraftRow, InsightReviewRow, InsightRow
from app.evidence.grading import EvidenceGrader, GradedSource
from app.evidence.taxonomy import AUDIENCES, LEVEL_ORDER, EvidenceLevel, level_rank
from app.evidence.verification import ClaimVerifier
from app.i18n import t
from app.llm.extractive import ExtractiveComposer
from app.llm.prompts import (
    INSIGHT_SCHEMA,
    PROMPT_VERSION,
    SYSTEM_INSIGHT,
    USER_INSIGHT,
    format_evidence,
    language_name,
)
from app.llm.providers import LLMError, LLMProvider, Message, parse_json_object
from app.retrieval.embeddings import Embedder
from app.retrieval.retriever import HybridRetriever, Personalization
from app.schemas.api import Insight, InsightList, InsightPoint, InsightSummary, RelatedInsight, TopicStatus
from app.schemas.evidence import Citation, EvidenceAssessment, EvidenceChunk
from app.settings import Settings

log = logging.getLogger(__name__)
_MARK = re.compile(r"\[(\d+)\]")
LIMITATION_CODES = {"observational", "single_source", "old", "mixed", "partial_support", "cap_no_human",
                    "cap_secondary_only", "cap_observational"}


_LEGACY_AUDIENCE = {"living_with_cancer": ["in_treatment", "after_treatment"]}


def _anchor_pattern(terms: list[str]) -> re.Pattern[str]:
    return re.compile(r"\b(?:" + "|".join(re.escape(fold_accents(t).lower()) for t in terms) + ")")


# Languages added after 1.0. Their titles/questions/anchors are kept apart from the base ones so that topic vectors and
# anchor matching for the original five languages stay exactly as they were.
BASE_LANGUAGES = ("en", "fr", "es", "pt", "de")
_AR_CLITICS = r"(?:[وفبكل]?ال|لل|[وفبكل])?"  # و/ف/ب/ك/ل + the definite article attach to the word


def _fold(text: str, lang: str | None) -> str:
    folded = fold_accents(text).lower()
    return normalize_arabic(folded) if lang == "ar" else folded


def _scoped_pattern(base: list[str], extra: list[str], lang: str) -> re.Pattern[str]:
    """Base terms plus a language's own terms (Arabic terms may carry clitic prefixes)."""
    plain = "|".join(re.escape(fold_accents(t).lower()) for t in base)
    local = "|".join(re.escape(_fold(t, lang)) for t in extra)
    prefix = _AR_CLITICS if lang == "ar" else ""
    return re.compile(r"\b(?:" + plain + ("|" + prefix + "(?:" + local + ")" if local else "") + ")")


@dataclass(slots=True)
class Topic:
    id: str
    category: str
    audience: list[str]
    cancer_types: list[str]
    priority: int
    title: dict[str, str]
    question: dict[str, str]
    queries: list[str]
    guidance: str
    anchors: list[re.Pattern[str]] = field(default_factory=list)
    anchors_i18n: dict[str, list[re.Pattern[str]]] = field(default_factory=dict)

    def anchor_patterns(self, lang: str | None) -> list[re.Pattern[str]]:
        return self.anchors_i18n.get(lang or "", self.anchors)

    def matches_text(self, text: str, lang: str | None) -> bool:
        patterns = self.anchor_patterns(lang)
        haystack = _fold(text, lang)
        return all(pattern.search(haystack) for pattern in patterns)

    def matches(self, evidence: EvidenceChunk) -> bool:
        """Precision gate: the passage (or its document title/section) must mention every anchor group."""
        if not self.anchors:
            return True
        return self.matches_text(f"{evidence.source.title} {evidence.section or ''} {evidence.text}",
                                 evidence.source.language)

    def text(self, field_name: str, lang: str) -> str:
        values: dict[str, str] = getattr(self, field_name)
        return values.get(lang) or values.get("en") or next(iter(values.values()))


@dataclass(slots=True)
class BuildResult:
    built: int = 0
    unchanged: int = 0
    insufficient: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {"built": self.built, "unchanged": self.unchanged, "insufficient": self.insufficient,
                "failed": self.failed, "errors": self.errors[:20]}


class InsightService:
    def __init__(self, settings: Settings, db: Database, retriever: HybridRetriever, verifier: ClaimVerifier,
                 grader: EvidenceGrader, embedder: Embedder, llm: LLMProvider | None,
                 composer: ExtractiveComposer) -> None:
        self.settings = settings
        self.db = db
        self.retriever = retriever
        self.verifier = verifier
        self.grader = grader
        self.embedder = embedder
        self.llm = llm
        self.composer = composer

    # ── taxonomy ─────────────────────────────────────────────────────────────
    @cached_property
    def topics(self) -> list[Topic]:
        path = Path(self.settings.insight_topics_file)  # type: ignore[arg-type]
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        return [
            Topic(id=t_["id"], category=t_["category"], audience=list(t_.get("audience") or []),
                  cancer_types=list(t_.get("cancer_types") or []), priority=int(t_.get("priority", 2)),
                  title=t_["title"], question=t_["question"], queries=list(t_.get("queries") or []),
                  guidance=t_.get("guidance", ""), anchors=[_anchor_pattern(g) for g in t_.get("anchors") or []],
                  anchors_i18n={lang: [_scoped_pattern(base, extra, lang)
                                       for base, extra in zip(t_.get("anchors") or [], groups, strict=True)]
                                for lang, groups in (t_.get("anchors_i18n") or {}).items()})
            for t_ in raw["topics"]
        ]

    @cached_property
    def _topic_index(self) -> dict[str, Topic]:
        return {topic.id: topic for topic in self.topics}

    @staticmethod
    def _topic_text(topic: Topic, lang: str | None = None) -> str:
        keep = (*BASE_LANGUAGES, lang)
        return " ".join([*(v for k, v in topic.title.items() if k in keep),
                         *(v for k, v in topic.question.items() if k in keep), *topic.queries])

    @cached_property
    def _topic_vectors(self) -> np.ndarray:
        return self.embedder.embed_documents([self._topic_text(t_) for t_ in self.topics])

    def _vectors_for(self, lang: str) -> np.ndarray:
        """Base vectors for the original languages; added languages also embed their own title and question."""
        if lang in BASE_LANGUAGES:
            return self._topic_vectors
        cache = self.__dict__.setdefault("_lang_vectors", {})
        if lang not in cache:
            cache[lang] = self.embedder.embed_documents([self._topic_text(t_, lang) for t_ in self.topics])
        return cache[lang]

    # ── generation ───────────────────────────────────────────────────────────
    def build_all(self, topic_ids: list[str] | None = None, languages: list[str] | None = None, force: bool = False,
                  progress: Callable[[float, str], None] | None = None,
                  should_cancel: Callable[[], bool] | None = None) -> BuildResult:
        progress = progress or (lambda _f, _m: None)
        languages = [lang for lang in (languages or self.settings.insight_languages)
                     if lang in self.settings.supported_languages]
        topics = [t_ for t_ in sorted(self.topics, key=lambda x: x.priority) if not topic_ids or t_.id in topic_ids]
        result = BuildResult()
        total = max(1, len(topics) * len(languages))
        for i, topic in enumerate(topics):
            for j, lang in enumerate(languages):
                if should_cancel and should_cancel():
                    raise InterruptedError("insight build cancelled")
                progress((i * len(languages) + j) / total, f"{topic.id} [{lang}]")
                try:
                    outcome = asyncio.run(self.build_one(topic, lang, force=force))
                except Exception as exc:
                    log.exception("insight %s/%s failed", topic.id, lang)
                    result.failed += 1
                    result.errors.append(f"{topic.id}/{lang}: {type(exc).__name__}: {exc}")
                    continue
                if outcome == "built":
                    result.built += 1
                elif outcome == "unchanged":
                    result.unchanged += 1
                else:
                    result.insufficient += 1
        progress(1.0, "Done")
        return result

    async def build_one(self, topic: Topic, lang: str, force: bool = False, use_llm: bool = True) -> str:
        question = topic.text("question", lang)
        retrieval = await asyncio.to_thread(
            self.retriever.retrieve, question, lang, k=self.settings.insight_evidence_k,
            extra_queries=topic.queries, personalization=Personalization(audience=(topic.audience or [None])[0]),
        )
        # keep only passages that are demonstrably about this topic, then renumber them [1..m]
        evidence = [e.model_copy(update={"n": i}) for i, e in
                    enumerate((e for e in retrieval.evidence if topic.matches(e)), start=1)]
        llm = self.llm if use_llm else None
        model_name = llm.model if llm else self.composer.name
        fingerprint = hashlib.sha256("|".join(
            [*sorted(f"{e.chunk_id}:{e.source.quality_score}" for e in evidence),
             self.llm.model if self.llm else self.composer.name, PROMPT_VERSION]
        ).encode()).hexdigest()
        insight_id = f"{topic.id}.{lang}"
        with self.db.session() as session:
            existing = session.get(InsightRow, insight_id)
            if existing and existing.source_fingerprint == fingerprint and not force:
                return "unchanged"
            draft = session.get(InsightDraftRow, insight_id) if self.settings.insight_review_required else None
            if draft is not None and draft.source_fingerprint == fingerprint and not force:
                return "unchanged"  # already waiting for (or refused by) a reviewer

        n_docs = len({e.source.document_id for e in evidence})
        if n_docs < self.settings.insight_min_sources:
            self._save(topic, lang, insight_id, fingerprint, model_name, status="insufficient_evidence",
                       content={"title": topic.text("title", lang), "summary": "", "key_points": [],
                                "recommendations": [], "limitations": []},
                       citations=[], assessment=self.grader.assess([], lang), points_meta=([], []))
            return "insufficient"

        content = await self._synthesise(topic, lang, question, evidence, llm)
        points, recs = content.get("key_points") or [], content.get("recommendations") or []
        items = points + recs
        results, _verification, citations, consistency = self.verifier.verify_points(
            [(item["text"], item.get("citations") or []) for item in items], evidence, lang)

        kept_points, kept_recs = [], []
        for idx, (item, (support, label)) in enumerate(zip(items, results, strict=True)):
            if label == "unsupported" or not item.get("citations"):
                continue  # never publish a statement its sources do not back
            entry = {"text": _MARK.sub("", item["text"]).strip(), "citations": list(item["citations"]),
                     "support": support, "label": label}
            (kept_points if idx < len(points) else kept_recs).append(entry)
        cited = sorted({n for p in kept_points + kept_recs for n in p["citations"]})
        by_n = {e.n: e for e in evidence}
        cited_docs = {by_n[n].source.document_id for n in cited if n in by_n}
        if not kept_points or len(cited_docs) < self.settings.insight_min_sources:
            if llm is not None:
                log.warning("LLM insight %s/%s had no verifiable points — falling back to extractive", topic.id, lang)
                return await self.build_one(topic, lang, force=True, use_llm=False)
            self._save(topic, lang, insight_id, fingerprint, model_name, status="insufficient_evidence",
                       content={"title": topic.text("title", lang), "summary": "", "key_points": [],
                                "recommendations": [], "limitations": []},
                       citations=[], assessment=self.grader.assess([], lang), points_meta=([], []))
            return "insufficient"

        citations = [c for c in citations if c.n in cited]
        support_by_doc: dict[str, float] = {}
        for c in citations:
            support_by_doc[c.source.document_id] = max(support_by_doc.get(c.source.document_id, 0.0), c.support or 0.0)
        graded = [GradedSource(by_n[n].source, support_by_doc.get(by_n[n].source.document_id)) for n in cited]
        partial = any(p["label"] == "partial" for p in kept_points + kept_recs)
        assessment = self.grader.assess(graded, lang, consistency=consistency, partial_support=partial)
        summary = _MARK.sub("", content.get("summary") or "").strip()
        content["summary"] = summary or kept_points[0]["text"]
        if llm is None and any(by_n[n].source.language != lang for n in cited):
            content["limitations"] = [*content.get("limitations", []), t("sources_other_language", lang)]
        self._save(topic, lang, insight_id, fingerprint, model_name, status="published", content=content,
                   citations=citations, assessment=assessment, points_meta=(kept_points, kept_recs))
        return "built"

    async def _synthesise(self, topic: Topic, lang: str, question: str, evidence: list[EvidenceChunk],
                          llm: LLMProvider | None) -> dict:
        if llm is None:
            return self.composer.insight(question, lang, evidence, topic.text("title", lang))
        preliminary = self.grader.assess([GradedSource(e.source) for e in evidence], lang)
        messages = [
            Message("system", SYSTEM_INSIGHT.format(brand=self.settings.app_name, language_name=language_name(lang))),
            Message("user", USER_INSIGHT.format(question=question, audience=", ".join(topic.audience),
                                                guidance=topic.guidance, grade=preliminary.label,
                                                evidence=format_evidence(evidence))),
        ]
        try:
            raw = await llm.complete(messages, json_schema=INSIGHT_SCHEMA, temperature=0.1, max_tokens=1400)
            data = parse_json_object(raw)
            valid_n = {e.n for e in evidence}
            for key in ("key_points", "recommendations"):
                cleaned = []
                for item in data.get(key) or []:
                    if isinstance(item, dict) and isinstance(item.get("text"), str):
                        cites = [int(n) for n in item.get("citations") or [] if str(n).isdigit() and int(n) in valid_n]
                        cleaned.append({"text": item["text"].strip(), "citations": cites})
                data[key] = cleaned
            data["title"] = (data.get("title") or topic.text("title", lang))[:120]
            data["limitations"] = [str(x) for x in (data.get("limitations") or []) if str(x).strip()][:4]
            if not data["key_points"]:
                raise LLMError("no key points")
            return data
        except (LLMError, ValueError, TypeError) as exc:
            log.warning("LLM synthesis failed for %s/%s (%s) — using extractive composer", topic.id, lang, exc)
            return self.composer.insight(question, lang, evidence, topic.text("title", lang))

    def _save(self, topic: Topic, lang: str, insight_id: str, fingerprint: str, model: str, *, status: str,
              content: dict[str, Any], citations: list[Citation], assessment: EvidenceAssessment,
              points_meta: tuple[list[dict], list[dict]]) -> None:
        points, recs = points_meta
        renumber = {c.n: i for i, c in enumerate(citations, start=1)}  # compact citation numbers 1..m
        for c in citations:
            c.n = renumber[c.n]
        for item in points + recs:
            item["citations"] = [renumber[n] for n in item["citations"] if n in renumber]
        limitations = list(content.get("limitations") or [])
        limitations += [r.text for r in assessment.rationale if r.code in LIMITATION_CODES and r.text not in limitations]
        values: dict[str, Any] = {
            "category": topic.category, "audience": topic.audience, "cancer_types": topic.cancer_types,
            "title": (content.get("title") or topic.text("title", lang))[:500],
            "question": topic.text("question", lang), "summary": content.get("summary", ""),
            "key_points": points, "recommendations": recs, "limitations": limitations[:6],
            "citations": [c.model_dump() for c in citations], "evidence": assessment.model_dump(),
            "evidence_level": assessment.level, "evidence_score": assessment.score, "status": status,
            "source_fingerprint": fingerprint, "model": model, "prompt_version": PROMPT_VERSION,
        }
        with self.db.session() as session:
            if self.settings.insight_review_required and status == "published":
                # clinical sign-off first: the public insight keeps its last approved content meanwhile
                draft = session.get(InsightDraftRow, insight_id)
                if draft is None:
                    draft = InsightDraftRow(id=insight_id, topic_id=topic.id, language=lang)
                    session.add(draft)
                draft.payload = {**values, "generated_at": datetime.now(UTC).isoformat()}
                draft.source_fingerprint, draft.status, draft.created_at = fingerprint, "pending", datetime.now(UTC)
                return
            draft = session.get(InsightDraftRow, insight_id)
            if draft is not None:  # superseded (e.g. the evidence no longer suffices): never publish a stale draft
                session.delete(draft)
            self._apply(session, insight_id, topic.id, lang, values)

    @staticmethod
    def _apply(session, insight_id: str, topic_id: str, lang: str, values: dict[str, Any]) -> InsightRow:
        row = session.get(InsightRow, insight_id)
        if row is None:
            row = InsightRow(id=insight_id, topic_id=topic_id, language=lang, version=0)
            session.add(row)
        for key, value in values.items():
            if key != "generated_at":
                setattr(row, key, value)
        row.version = (row.version or 0) + 1
        row.generated_at = datetime.now(UTC)
        return row

    # ── reads ────────────────────────────────────────────────────────────────
    def _audience(self, row: InsightRow) -> list[str]:
        """The taxonomy is the source of truth (journeys can be re-tagged without rebuilding insights); rows from
        older taxonomies are mapped (living_with_cancer → in_treatment + after_treatment)."""
        topic = self._topic_index.get(row.topic_id)
        if topic is not None:
            return list(topic.audience)
        mapped: list[str] = []
        for a in row.audience or []:
            mapped += _LEGACY_AUDIENCE.get(a, [a])
        return [a for a in dict.fromkeys(mapped) if a in AUDIENCES]

    def _summary(self, row: InsightRow) -> InsightSummary:
        ev = row.evidence or {}
        return InsightSummary(
            id=row.id, topic_id=row.topic_id, language=row.language, category=row.category,
            audience=self._audience(row),
            cancer_types=row.cancer_types, title=row.title, question=row.question, summary=row.summary,
            evidence_level=row.evidence_level, evidence_grade=ev.get("grade", "–"), evidence_score=row.evidence_score,
            n_sources=int(ev.get("n_sources", 0)), status=row.status, updated_at=row.updated_at,
        )

    def list(self, *, language: str, category: str | None = None, audience: str | None = None,
             min_level: str | None = None, q: str | None = None, cancer_type: str | None = None,
             include_insufficient: bool = False, page: int = 1, page_size: int = 24) -> InsightList:
        with self.db.session() as session:
            stmt = select(InsightRow).where(InsightRow.language == language, InsightRow.status != "needs_review")
            if not include_insufficient:
                stmt = stmt.where(InsightRow.status == "published")
            if category:
                stmt = stmt.where(InsightRow.category == category)
            if min_level:
                allowed = [lvl.value for lvl in LEVEL_ORDER if level_rank(lvl) <= level_rank(min_level)]
                stmt = stmt.where(InsightRow.evidence_level.in_(allowed))
            rows = list(session.scalars(stmt.order_by(InsightRow.evidence_score.desc(), InsightRow.title)))
        if audience:
            rows = [r for r in rows if audience in self._audience(r)]
        if cancer_type:
            rows = [r for r in rows if cancer_type in (r.cancer_types or [])]
        if q:
            needle = q.lower()
            rows = [r for r in rows if needle in f"{r.title} {r.question} {r.summary}".lower()]
        total = len(rows)
        start = (page - 1) * page_size
        return InsightList(items=[self._summary(r) for r in rows[start: start + page_size]], total=total, page=page,
                           page_size=page_size)

    def get(self, insight_id: str, include_withdrawn: bool = False) -> Insight | None:
        with self.db.session() as session:
            row = session.get(InsightRow, insight_id)
            if row is None or (row.status == "needs_review" and not include_withdrawn):
                return None
            reviewed = session.scalar(select(func.max(InsightReviewRow.created_at)).where(
                InsightReviewRow.insight_id == insight_id, InsightReviewRow.decision == "approved",
                InsightReviewRow.source_fingerprint == row.source_fingerprint))
            return self._render(row, reviewed_at=reviewed)

    def _render(self, row: InsightRow, reviewed_at: datetime | None = None) -> Insight:
        summary = self._summary(row)
        return Insight(
            **summary.model_dump(),
            key_points=[InsightPoint(**p) for p in row.key_points],
            recommendations=[InsightPoint(**p) for p in row.recommendations],
            limitations=row.limitations, citations=[Citation(**c) for c in row.citations],
            evidence=EvidenceAssessment(**row.evidence) if row.evidence else self.grader.assess([], row.language),
            model=row.model, prompt_version=row.prompt_version, version=row.version,
            generated_at=row.generated_at, reviewed_at=reviewed_at,
        )

    # ── clinical review (docs/BUILD_SPEC.md §8, §16) ─────────────────────────
    def review_items(self, state: str = "pending") -> list[dict[str, Any]]:
        """pending: rebuilt insights waiting for sign-off · rejected: drafts a reviewer refused ·
        unreviewed: public insights without an approval for their current evidence · withdrawn: taken down."""
        out: list[dict[str, Any]] = []
        with self.db.session() as session:
            if state in ("pending", "rejected"):
                for draft in session.scalars(select(InsightDraftRow).where(InsightDraftRow.status == state)
                                             .order_by(InsightDraftRow.created_at)):
                    current = session.get(InsightRow, draft.id)
                    out.append({"insight": self._render(self._draft_row(draft, current)).model_dump(mode="json"),
                                "state": state, "submitted_at": draft.created_at,
                                "has_public_version": current is not None and current.status == "published"})
                return out
            approved = {(i, f) for i, f in session.execute(select(
                InsightReviewRow.insight_id, InsightReviewRow.source_fingerprint).where(
                InsightReviewRow.decision == "approved"))}
            status = "needs_review" if state == "withdrawn" else "published"
            for row in session.scalars(select(InsightRow).where(InsightRow.status == status)
                                       .order_by(InsightRow.topic_id, InsightRow.language)):
                if state == "withdrawn" or (row.id, row.source_fingerprint) not in approved:
                    out.append({"insight": self._render(row).model_dump(mode="json"), "state": state,
                                "submitted_at": row.generated_at, "has_public_version": state != "withdrawn"})
        return out

    def review(self, insight_id: str, decision: str, reviewer: str, note: str | None = None) -> dict[str, Any]:
        """approve: publish the pending draft (or sign off / restore the current version) ·
        reject: refuse the pending draft (or withdraw the public insight until it is rebuilt and approved)."""
        with self.db.session() as session:
            draft = session.get(InsightDraftRow, insight_id)
            row = session.get(InsightRow, insight_id)
            if draft is not None and draft.status == "pending":
                if decision == "approved":
                    row = self._apply(session, insight_id, draft.topic_id, draft.language, draft.payload)
                    session.delete(draft)
                else:
                    draft.status = "rejected"
                fingerprint, version = draft.source_fingerprint, (row.version if row is not None else 0)
            elif row is not None:
                if decision == "approved" and row.status == "needs_review":
                    row.status = "published"  # restore
                elif decision == "rejected" and row.status == "published":
                    row.status = "needs_review"  # withdraw
                fingerprint, version = row.source_fingerprint, row.version
            else:
                raise KeyError(insight_id)
            session.add(InsightReviewRow(insight_id=insight_id, version=version, source_fingerprint=fingerprint,
                                         decision=decision, reviewer=reviewer, note=note))
            return {"id": insight_id, "decision": decision, "version": version,
                    "status": row.status if row is not None else "pending"}

    @staticmethod
    def _draft_row(draft: InsightDraftRow, current: InsightRow | None) -> InsightRow:
        values = {k: v for k, v in draft.payload.items() if k != "generated_at"}
        generated = datetime.fromisoformat(draft.payload.get("generated_at") or datetime.now(UTC).isoformat())
        return InsightRow(id=draft.id, topic_id=draft.topic_id, language=draft.language, **values,
                          version=(current.version if current else 0) + 1, generated_at=generated, updated_at=generated)

    def topic_statuses(self, language: str) -> list[TopicStatus]:
        with self.db.session() as session:
            rows = {r.topic_id: r for r in session.scalars(select(InsightRow).where(InsightRow.language == language))}
        out = []
        for topic in self.topics:
            row = rows.get(topic.id)
            out.append(TopicStatus(
                id=topic.id, category=topic.category, audience=topic.audience, title=topic.text("title", language),
                question=topic.text("question", language), status=row.status if row else "pending",
                evidence_level=row.evidence_level if row else None, insight_id=row.id if row else None,
            ))
        return out

    def related(self, text: str, language: str, k: int = 3) -> list[RelatedInsight]:
        if not self.topics:
            return []
        q = self.embedder.embed_query(text)
        sims = self._vectors_for(language) @ q
        order = np.argsort(-sims)[: k * 3]
        ids = [f"{self.topics[i].id}.{language}" for i in order if sims[i] > 0.05]
        if not ids:
            return []
        with self.db.session() as session:
            rows = {r.id: r for r in session.scalars(
                select(InsightRow).where(InsightRow.id.in_(ids), InsightRow.status == "published"))}
        return [RelatedInsight(id=r.id, title=r.title, category=r.category, evidence_level=r.evidence_level)
                for i in ids if (r := rows.get(i))][:k]

    def match_text(self, text: str, language: str, audience: str | None = None) -> RelatedInsight | None:
        """Published insight whose topic anchors all occur in a free text (used to link community posts to
        "what the research says"). Precision over recall: no anchors, no link."""
        candidates = [t_ for t_ in self.topics if t_.anchors and t_.matches_text(text, language)]
        if not candidates:
            return None
        candidates.sort(key=lambda t_: (audience not in t_.audience if audience else False, t_.priority,
                                        -len(t_.anchors)))
        ids = [f"{t_.id}.{language}" for t_ in candidates]
        with self.db.session() as session:
            rows = {r.id: r for r in session.scalars(
                select(InsightRow).where(InsightRow.id.in_(ids), InsightRow.status == "published"))}
        for insight_id in ids:
            if (r := rows.get(insight_id)) is not None:
                return RelatedInsight(id=r.id, title=r.title, category=r.category, evidence_level=r.evidence_level)
        return None

    def count_published(self) -> int:
        with self.db.session() as session:
            return int(session.scalar(select(func.count()).select_from(InsightRow)
                                      .where(InsightRow.status == "published")) or 0)

    def cited_by(self, document_id: str, language: str | None = None) -> list[RelatedInsight]:
        with self.db.session() as session:
            stmt = select(InsightRow).where(InsightRow.status == "published")
            if language:
                stmt = stmt.where(InsightRow.language == language)
            rows = [r for r in session.scalars(stmt)
                    if any(c.get("source", {}).get("document_id") == document_id for c in r.citations)]
        return [RelatedInsight(id=r.id, title=r.title, category=r.category, evidence_level=r.evidence_level)
                for r in rows]


def localized_abstain(lang: str) -> str:
    return t("abstain", lang)


__all__ = ["BuildResult", "EvidenceLevel", "InsightService", "Topic", "localized_abstain"]
