"""Public API: status, metadata, chat, search, insights, documents, feedback."""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.deps import container_dep, rate_limit, resolve_language
from app.container import Container
from app.core.metrics import FEEDBACK
from app.core.pii import scrub
from app.db.models import FeedbackRow
from app.evidence.taxonomy import AUDIENCES, CATEGORIES, CREDIBILITY, DESIGN, LEVEL_ORDER, LEVELS
from app.schemas.api import (
    ChatRequest,
    ChatResponse,
    DocumentDetail,
    DocumentList,
    FeedbackCreate,
    Insight,
    InsightList,
    PlatformStatus,
    SearchRequest,
    SearchResponse,
    TopicStatus,
)

router = APIRouter()


def cached_json(request: Request, payload: Any, max_age: int = 60) -> Response:
    """JSON with a strong ETag and CDN-friendly caching (304 when unchanged)."""
    body = json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":")).encode()
    etag = '"' + hashlib.sha1(body, usedforsecurity=False).hexdigest() + '"'
    headers = {"ETag": etag, "Cache-Control": f"public, max-age={max_age}, stale-while-revalidate={max_age * 10}",
               "Vary": "Accept-Language"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)


@router.get("/status", response_model=PlatformStatus, tags=["platform"])
async def status(c: Container = Depends(container_dep)) -> PlatformStatus:
    available = await c.llm.health() if c.llm else None
    result = c.platform.status(llm_available=available)
    if c.settings.environment in ("production", "staging"):
        # Public endpoint: do not reveal bucket names or server paths. The admin API has the full locations.
        for source in result.sources:
            source.uri = f"{source.kind}://…"
    return result


@router.get("/meta", tags=["platform"])
def meta(request: Request, c: Container = Depends(container_dep)) -> Response:
    """Definitions the UI uses to explain evidence: levels, study designs, credibility tiers, categories."""
    payload = {
        "app": c.settings.app_name,
        "languages": c.settings.supported_languages,
        "default_language": c.settings.default_language,
        "evidence_levels": [{"id": lvl.value, "grade": LEVELS[lvl].grade, "label": LEVELS[lvl].label,
                             "min_score": LEVELS[lvl].min_score, "description": LEVELS[lvl].description}
                            for lvl in LEVEL_ORDER],
        "study_designs": [{"id": k.value, "label": v.label, "weight": v.weight, "tier": v.tier,
                           "human_evidence": v.human_evidence, "description": v.description}
                          for k, v in sorted(DESIGN.items(), key=lambda kv: (kv[1].tier, -kv[1].weight))],
        "credibility_tiers": [{"id": k.value, "multiplier": v[0], "label": v[1], "description": v[2]}
                              for k, v in CREDIBILITY.items()],
        "categories": [{"id": k, "label": v} for k, v in CATEGORIES.items()],
        "audiences": [{"id": k, "label": v} for k, v in AUDIENCES.items()],
    }
    return cached_json(request, payload, max_age=3600)


LEGAL_FIELDS = {
    "name": "legal_operator_name", "address": "legal_operator_address", "email": "legal_contact_email",
    "phone": "legal_contact_phone", "representative": "legal_representative", "register": "legal_register",
    "vat_id": "legal_vat_id", "content_responsible": "legal_content_responsible", "dpo": "legal_dpo_contact",
    "supervisory_authority": "legal_supervisory_authority", "hosting": "legal_hosting",
    "accessibility_authority": "legal_accessibility_authority",
}
# Needed before launch in any case; the others depend on the operator (a register entry only for companies, etc.).
LEGAL_REQUIRED = ("name", "address", "email", "content_responsible", "supervisory_authority", "hosting")


@router.get("/legal", tags=["platform"])
def legal(request: Request, c: Container = Depends(container_dep)) -> Response:
    """Operator details for the privacy policy, terms, legal notice and accessibility statement."""
    s = c.settings
    operator: dict[str, Any] = {}
    for key, attr in LEGAL_FIELDS.items():
        value = (getattr(s, attr) or "").strip()
        operator[key] = value or None
    if operator["address"]:
        operator["address"] = [line.strip() for line in operator["address"].split("|") if line.strip()]
    payload = {
        "operator": operator,
        "effective_date": s.legal_effective_date,
        "approved": s.legal_approved,
        "missing": [k for k in LEGAL_REQUIRED if not operator.get(k)],
    }
    return cached_json(request, payload, max_age=600)


@router.post("/chat", tags=["assistant"], response_model=ChatResponse,
             dependencies=[Depends(rate_limit("chat"))],
             responses={200: {"content": {"text/event-stream": {}}}})
async def chat(body: ChatRequest, c: Container = Depends(container_dep)):
    if body.messages[-1].role != "user":
        raise HTTPException(422, "the last message must come from the user")
    if not body.stream:
        return await c.chat.answer(body)

    async def events():
        try:
            async for name, payload in c.chat.stream(body):
                yield f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
        except Exception as exc:  # surface as an SSE error event instead of a broken stream
            err = {"code": "internal_error", "message": "The answer could not be completed.",
                   "detail": type(exc).__name__}
            yield f"event: error\ndata: {json.dumps(err)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
                                      "Connection": "keep-alive"})


@router.post("/search", response_model=SearchResponse, tags=["evidence"], dependencies=[Depends(rate_limit("api"))])
def search(body: SearchRequest, c: Container = Depends(container_dep)) -> SearchResponse:
    return c.platform.search(body)


@router.get("/insights", response_model=InsightList, tags=["insights"])
def list_insights(
    request: Request,
    lang: str | None = Query(None, description="Language code"),
    category: str | None = None,
    audience: str | None = None,
    min_level: str | None = Query(None, pattern="^(high|moderate|low|very_low)$"),
    q: str | None = Query(None, max_length=200),
    cancer_type: str | None = None,
    include_insufficient: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    c: Container = Depends(container_dep),
) -> Response:
    language = resolve_language(lang or request.headers.get("accept-language"), c)
    result = c.insights.list(language=language, category=category, audience=audience, min_level=min_level, q=q,
                             cancer_type=cancer_type, include_insufficient=include_insufficient, page=page,
                             page_size=page_size)
    return cached_json(request, result.model_dump(mode="json"))


@router.get("/insights/{insight_id}", response_model=Insight, tags=["insights"])
def get_insight(insight_id: str, request: Request, c: Container = Depends(container_dep)) -> Response:
    insight = c.insights.get(insight_id)
    if insight is None:
        raise HTTPException(404, "insight not found")
    return cached_json(request, insight.model_dump(mode="json"))


@router.get("/topics", response_model=list[TopicStatus], tags=["insights"])
def topics(request: Request, lang: str | None = None, c: Container = Depends(container_dep)) -> Response:
    language = resolve_language(lang or request.headers.get("accept-language"), c)
    return cached_json(request, [t.model_dump() for t in c.insights.topic_statuses(language)])


@router.get("/documents", response_model=DocumentList, tags=["evidence"])
def documents(
    request: Request,
    q: str | None = Query(None, max_length=200),
    source_type: str | None = None,
    language: str | None = None,
    min_year: int | None = None,
    sort: str = Query("quality", pattern="^(quality|year|title)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    c: Container = Depends(container_dep),
) -> Response:
    result = c.platform.documents(q=q, source_type=source_type, language=language, min_year=min_year, page=page,
                                  page_size=page_size, sort=sort)
    return cached_json(request, result.model_dump(mode="json"))


@router.get("/documents/{doc_id}", response_model=DocumentDetail, tags=["evidence"])
def document(doc_id: str, request: Request, lang: str | None = None, c: Container = Depends(container_dep)) -> Response:
    detail = c.platform.document(doc_id, resolve_language(lang, c) if lang else None)
    if detail is None:
        raise HTTPException(404, "document not found")
    return cached_json(request, detail.model_dump(mode="json"))


@router.get("/chunks/{chunk_id}", tags=["evidence"])
def chunk(chunk_id: str, c: Container = Depends(container_dep)) -> dict:
    found = c.platform.chunk(chunk_id)
    if found is None:
        raise HTTPException(404, "passage not found")
    passage, document = found
    return {"chunk": passage.model_dump(), "document": document.model_dump(mode="json")}


@router.get("/transparency", tags=["community"])
def transparency(request: Request, quarter: str | None = Query(None, pattern=r"^\d{4}-[Qq][1-4]$"),
                 c: Container = Depends(container_dep)) -> Response:
    """Quarterly community moderation report: aggregate counts only, small numbers suppressed. Public."""
    from app.community.service import CommunityError

    try:
        report = c.community.transparency(quarter)
    except CommunityError as exc:
        raise HTTPException(exc.status, exc.code) from exc
    return cached_json(request, report, max_age=600)


@router.post("/feedback", status_code=201, tags=["feedback"], dependencies=[Depends(rate_limit("api"))])
def feedback(body: FeedbackCreate, c: Container = Depends(container_dep)) -> JSONResponse:
    with c.db.session() as session:
        session.add(FeedbackRow(id=uuid.uuid4().hex[:20], target_type=body.target_type, target_id=body.target_id,
                                rating=body.rating, reasons=list(body.reasons),
                                comment=scrub(body.comment) if body.comment else None, language=body.language))
    FEEDBACK.labels(target_type=body.target_type, rating=str(body.rating)).inc()
    return JSONResponse({"ok": True}, status_code=201)
