"""Grounded conversational answering with streaming, verification and evidence grading.

Event stream (Server-Sent Events):
  meta     → request id, language, model, safety assessment
  evidence → numbered passages retrieved (shown while the answer is written)
  delta    → answer text increments
  final    → ChatResponse: answer, citations with quotes, claim verification, evidence grade, related insights
  error    → recoverable error description
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.core.language import detect_language
from app.core.metrics import (
    CHAT_ANSWERS,
    CHAT_REQUESTS,
    CHAT_STAGE_SECONDS,
    GROUNDED_RATIO,
    LLM_VARIANT_ANSWERS,
    LLM_VARIANT_GROUNDED,
    LLM_VARIANT_UNSUPPORTED,
    SAFETY_TRIGGERS,
    UNSUPPORTED_CLAIMS,
)
from app.core.pii import scrub
from app.db.base import Database
from app.db.models import ChatTraceRow
from app.evidence.grading import EvidenceGrader, GradedSource
from app.evidence.verification import ClaimVerifier
from app.i18n import t
from app.llm.extractive import ExtractiveComposer
from app.llm.prompts import CONDENSE, SYSTEM_CHAT, USER_CHAT, format_evidence, format_profile, language_name
from app.llm.providers import LLMError, LLMProvider, Message
from app.retrieval.retriever import HybridRetriever, Personalization
from app.retrieval.vectorstores.base import SearchFilters, VectorStore
from app.safety.guardrails import Guardrails, SafetyAssessment
from app.schemas.api import ChatRequest, ChatResponse
from app.services.insights import InsightService
from app.settings import Settings

log = logging.getLogger(__name__)
Event = tuple[str, dict[str, Any]]


def filters_from(request_filters, profile) -> SearchFilters:
    f = SearchFilters()
    if request_filters:
        f.source_types = request_filters.source_types or None
        f.min_year = request_filters.min_year
        f.languages = request_filters.languages or None
        f.cancer_types = request_filters.cancer_types or None
        f.min_quality = request_filters.min_quality
    return f


class ChatService:
    def __init__(self, settings: Settings, db: Database, retriever: HybridRetriever, store: VectorStore,
                 verifier: ClaimVerifier, grader: EvidenceGrader, guardrails: Guardrails, llm: LLMProvider | None,
                 composer: ExtractiveComposer, insights: InsightService, canary: LLMProvider | None = None) -> None:
        self.settings = settings
        self.db = db
        self.retriever = retriever
        self.store = store
        self.verifier = verifier
        self.grader = grader
        self.guardrails = guardrails
        self.llm = llm
        self.composer = composer
        self.insights = insights
        self.canary = canary

    @property
    def model_name(self) -> str:
        return self.llm.model if self.llm else self.composer.name

    def _route(self, rid: str) -> tuple[LLMProvider | None, str]:
        """Stable model, or the canary for LLM_CANARY_PERCENT % of requests (bucketed on the request id)."""
        if self.canary is not None and self.llm is not None:
            bucket = int(hashlib.sha256(rid.encode()).hexdigest()[:8], 16) % 10_000 / 100
            if bucket < self.settings.llm_canary_percent:
                return self.canary, "canary"
        return self.llm, "stable"

    async def answer(self, request: ChatRequest) -> ChatResponse:
        final: dict[str, Any] | None = None
        async for name, payload in self.stream(request):
            if name == "final":
                final = payload
        assert final is not None
        return ChatResponse(**final)

    async def stream(self, request: ChatRequest) -> AsyncIterator[Event]:
        s = self.settings
        rid = uuid.uuid4().hex[:16]
        llm, variant = self._route(rid)
        model_name = llm.model if llm else self.composer.name
        timings: dict[str, float] = {}
        t0 = time.perf_counter()
        history = request.messages[-s.max_history_messages:]
        question = history[-1].content.strip()[: s.max_message_chars]
        hint = (request.ui_language or "")[:2].lower() or None
        lang = (request.language or "")[:2].lower()
        if lang not in s.supported_languages:
            lang = detect_language(question, s.supported_languages, hint=hint)
        profile = request.profile
        country = profile.country if profile else None

        safety = self.guardrails.check_input(question, lang, country)
        for rule in safety.flags:
            SAFETY_TRIGGERS.labels(rule=rule, language=lang, surface="chat").inc()
        yield "meta", {"id": rid, "language": lang, "model": model_name, "safety": safety.model_dump()}

        def finish(answer: str, **extra: Any) -> Event:
            timings["total"] = round((time.perf_counter() - t0) * 1000, 1)
            body = {"id": rid, "answer": answer, "language": lang, "safety": safety.model_dump(),
                    "disclaimer": t("disclaimer", lang), "model": model_name, "timings_ms": timings, **extra}
            CHAT_REQUESTS.labels(language=lang, safety=safety.level,
                                 outcome="abstained" if body.get("abstained") else "answered").inc()
            return "final", ChatResponse(**body).model_dump(mode="json")  # complete payload, defaults filled

        if safety.block_generation:
            yield finish(" ".join(n.message for n in safety.notices), abstained=True, abstain_reason="safety")
            return
        if await asyncio.to_thread(self.store.count) == 0:
            yield finish(t("awaiting_data", lang), abstained=True, abstain_reason="awaiting_data")
            return

        # 1 — standalone query for retrieval
        t_q = time.perf_counter()
        query = await self._standalone_query(history, question, lang)
        timings["condense"] = round((time.perf_counter() - t_q) * 1000, 1)

        # 2 — retrieval
        t_r = time.perf_counter()
        personalization = Personalization(cancer_types=profile.cancer_types if profile else [],
                                          audience=profile.audience if profile else None)
        retrieval = await asyncio.to_thread(
            self.retriever.retrieve, query, lang, filters=filters_from(request.filters, profile),
            personalization=personalization,
        )
        timings["retrieval"] = round((time.perf_counter() - t_r) * 1000, 1)
        CHAT_STAGE_SECONDS.labels(stage="retrieval").observe(timings["retrieval"] / 1000)
        evidence = retrieval.evidence
        yield "evidence", {"evidence": [e.model_dump() for e in evidence], "trace": retrieval.trace}
        if not evidence or retrieval.answerability < s.answerability_threshold:
            notices = " ".join(n.message for n in safety.notices)
            yield finish(f"{notices}\n\n{t('abstain', lang)}".strip(), abstained=True,
                         abstain_reason="insufficient_evidence", retrieved=0)
            return

        # 3 — generation (LLM streaming, extractive fallback)
        preliminary = self.grader.assess([GradedSource(e.source) for e in evidence], lang)
        t_g = time.perf_counter()
        parts: list[str] = []
        used_model = model_name
        generated = False  # safety notices travel in `meta`/`final.safety` and render as a banner, not as answer text
        if llm is not None:
            messages = self._messages(history, question, lang, evidence, preliminary.label, safety, profile)
            try:
                async for piece in llm.stream(messages):
                    parts.append(piece)
                    generated = True
                    yield "delta", {"text": piece}
            except LLMError as exc:
                log.warning("LLM unavailable (%s) — extractive fallback", exc)
                if generated:
                    yield "error", {"code": "generation_interrupted", "message": "The answer was interrupted."}
        if not generated:
            used_model = self.composer.name
            text = self.composer.answer(question, lang, evidence)
            if not text:
                yield finish(t("abstain", lang), abstained=True, abstain_reason="insufficient_evidence",
                             retrieved=len(evidence))
                return
            parts.append(text)
            yield "delta", {"text": text}
        answer = "".join(parts).strip()
        mode = "llm" if generated else ("extractive_fallback" if llm is not None else "extractive")
        CHAT_ANSWERS.labels(language=lang, mode=mode).inc()
        LLM_VARIANT_ANSWERS.labels(variant=variant, mode=mode).inc()
        timings["generation"] = round((time.perf_counter() - t_g) * 1000, 1)
        CHAT_STAGE_SECONDS.labels(stage="generation").observe(timings["generation"] / 1000)

        # 4 — verification, grading, related insights
        t_v = time.perf_counter()
        output_flags = self.guardrails.check_output(answer)
        verification, citations, consistency = await asyncio.to_thread(self.verifier.verify, answer, evidence, lang)
        support_by_doc: dict[str, float] = {}
        for c in citations:
            support_by_doc[c.source.document_id] = max(support_by_doc.get(c.source.document_id, 0.0), c.support or 0.0)
        cited_sources = {c.source.document_id: c.source for c in citations}
        assessment = self.grader.assess(
            [GradedSource(src, support_by_doc.get(doc_id)) for doc_id, src in cited_sources.items()], lang,
            consistency=consistency, partial_support=any(c.label == "partial" for c in verification.claims),
        )
        GROUNDED_RATIO.observe(verification.grounded_ratio)
        LLM_VARIANT_GROUNDED.labels(variant=variant).observe(verification.grounded_ratio)
        unsupported = sum(1 for c in verification.claims if c.label == "unsupported")
        if unsupported:
            UNSUPPORTED_CLAIMS.inc(unsupported)
            LLM_VARIANT_UNSUPPORTED.labels(variant=variant).inc(unsupported)
        related = await asyncio.to_thread(self.insights.related, query, lang)
        timings["verification"] = round((time.perf_counter() - t_v) * 1000, 1)

        final = finish(
            answer, citations=[c.model_dump() for c in citations], evidence=assessment.model_dump(),
            verification=verification.model_dump(), output_flags=output_flags,
            related_insights=[r.model_dump() for r in related], retrieved=len(evidence),
        )
        final[1]["model"] = used_model
        yield final
        if s.store_conversations:
            await asyncio.to_thread(self._trace, rid, lang, question, answer, final[1], safety, retrieval.trace)

    # ── helpers ──────────────────────────────────────────────────────────────
    async def _standalone_query(self, history, question: str, lang: str) -> str:
        prior_user = [m.content for m in history[:-1] if m.role == "user"]
        if not prior_user:
            return question
        if self.llm is not None:
            convo = "\n".join(f"{m.role}: {m.content[:500]}" for m in history[-6:-1])
            try:
                rewritten = await asyncio.wait_for(
                    self.llm.complete([Message("user", CONDENSE.format(history=convo, question=question))],
                                      max_tokens=80, temperature=0.0),
                    timeout=8.0,
                )
                rewritten = rewritten.strip().strip('"').split("\n")[0]
                if 5 < len(rewritten) < 400:
                    return rewritten
            except (TimeoutError, LLMError):
                pass
        if len(question.split()) < 8:  # elliptical follow-up ("and for women?") → add previous context
            return f"{prior_user[-1]} {question}"
        return question

    def _messages(self, history, question: str, lang: str, evidence, grade_label: str, safety: SafetyAssessment,
                  profile) -> list[Message]:
        safety_block = ""
        cautions = [n for n in safety.notices if n.level in ("caution", "urgent")]
        if cautions:
            safety_block = "Safety context (address it first, kindly): " + " ".join(n.message for n in cautions) + "\n\n"
        system = SYSTEM_CHAT.format(brand=self.settings.app_name, language_name=language_name(lang))
        messages = [Message("system", system)]
        for m in history[:-1][-6:]:
            messages.append(Message(m.role, m.content[:1500]))
        messages.append(Message("user", USER_CHAT.format(
            profile_block=format_profile(profile.model_dump() if profile else None), grade=grade_label,
            evidence=format_evidence(evidence), safety_block=safety_block, question=question,
        )))
        return messages

    def _trace(self, rid: str, lang: str, question: str, answer: str, final: dict, safety: SafetyAssessment,
               trace: dict) -> None:
        try:
            with self.db.session() as session:
                session.add(ChatTraceRow(
                    id=rid, language=lang, query=scrub(question), answer=answer,
                    citations=[{"n": c["n"], "document_id": c["source"]["document_id"], "support": c.get("support")}
                               for c in final.get("citations", [])],
                    evidence={k: final.get("evidence", {}).get(k) for k in ("level", "score", "n_sources")},
                    safety=safety.model_dump(), retrieval=trace, model=final.get("model", ""),
                    latency_ms=int(final.get("timings_ms", {}).get("total", 0)),
                ))
        except Exception:  # tracing must never break answering
            log.exception("failed to store chat trace")
