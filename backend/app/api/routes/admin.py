"""Admin API (X-Admin-Key / Bearer): data sources, ingestion, insight builds, evaluation, fine-tuning export."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import container_dep, require_admin
from app.container import Container
from app.datasources.registry import DEFAULT_EXCLUDE, DEFAULT_INCLUDE, SourceSpec
from app.datasources.uri import parse_source_uri, redact_options, redact_uri
from app.db.models import DocumentRow, FeedbackRow, JobRow
from app.schemas.api import (
    EvaluateRequest,
    ExportRequest,
    IngestRequest,
    InsightBuildRequest,
    InsightReviewCreate,
    Job,
    SourceCreate,
    SourceUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _job(row: JobRow) -> Job:
    return Job(id=row.id, kind=row.kind, status=row.status, triggered_by=row.triggered_by, params=row.params,
               progress=row.progress, message=row.message, stats=row.stats, error=row.error,
               created_at=row.created_at, started_at=row.started_at, finished_at=row.finished_at)


def _source_out(spec: SourceSpec, c: Container) -> dict:
    try:
        kind = parse_source_uri(spec.uri, c.settings.project_root).kind
    except ValueError:
        kind = "invalid"
    return {**spec.model_dump(exclude={"storage_options"}), "uri": redact_uri(spec.uri), "kind": kind,
            "storage_options": redact_options(spec.storage_options)}


@router.get("/sources")
def list_sources(c: Container = Depends(container_dep)) -> list[dict]:
    return [_source_out(s, c) for s in c.registry.sync_config()]


@router.post("/sources", status_code=201)
def create_source(body: SourceCreate, c: Container = Depends(container_dep)) -> dict:
    spec = SourceSpec(id=body.id, name=body.name, uri=body.uri, enabled=body.enabled, origin="api",
                      include=body.include or list(DEFAULT_INCLUDE), exclude=body.exclude or list(DEFAULT_EXCLUDE),
                      storage_options=body.storage_options, defaults=body.defaults)
    try:
        created = c.registry.create(spec)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _source_out(created, c)


@router.patch("/sources/{source_id}")
def update_source(source_id: str, body: SourceUpdate, c: Container = Depends(container_dep)) -> dict:
    try:
        spec = c.registry.update(source_id, body.model_dump(exclude_none=True))
    except KeyError as exc:
        raise HTTPException(404, "source not found") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _source_out(spec, c)


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(source_id: str, c: Container = Depends(container_dep)) -> None:
    try:
        c.registry.delete(source_id)
    except KeyError as exc:
        raise HTTPException(404, "source not found") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    c.jobs.submit("ingest", {"mode": "incremental"}, triggered_by="admin")  # purge its documents


@router.post("/sources/{source_id}/test")
def test_source(source_id: str, c: Container = Depends(container_dep)) -> dict:
    spec = c.registry.get(source_id)
    if spec is None:
        raise HTTPException(404, "source not found")
    try:
        c.registry.validate(spec)
        return c.scanner.test(spec)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


@router.post("/ingest", response_model=Job, status_code=202)
def ingest(body: IngestRequest, c: Container = Depends(container_dep)) -> Job:
    return _job(c.jobs.submit("ingest", body.model_dump(), triggered_by="admin"))


@router.post("/insights/rebuild", response_model=Job, status_code=202)
def rebuild_insights(body: InsightBuildRequest, c: Container = Depends(container_dep)) -> Job:
    return _job(c.jobs.submit("insights", body.model_dump(), triggered_by="admin"))


@router.get("/insights/review")
def insight_reviews(state: str = Query("pending", pattern="^(pending|rejected|unreviewed|withdrawn)$"),
                    c: Container = Depends(container_dep)) -> list[dict]:
    """Clinical review queue. With INSIGHT_REVIEW_REQUIRED=true, rebuilt insights wait here as drafts."""
    return c.insights.review_items(state)


@router.post("/insights/{insight_id}/review")
def review_insight(insight_id: str, body: InsightReviewCreate, c: Container = Depends(container_dep)) -> dict:
    try:
        return c.insights.review(insight_id, body.decision, body.reviewer, body.note)
    except KeyError as exc:
        raise HTTPException(404, "insight not found") from exc


@router.post("/evaluate", response_model=Job, status_code=202)
def evaluate(body: EvaluateRequest, c: Container = Depends(container_dep)) -> Job:
    return _job(c.jobs.submit("evaluate", body.model_dump(), triggered_by="admin"))


@router.post("/export/sft", response_model=Job, status_code=202)
def export_sft(body: ExportRequest, c: Container = Depends(container_dep)) -> Job:
    return _job(c.jobs.submit("export_sft", body.model_dump(), triggered_by="admin"))


@router.get("/jobs", response_model=list[Job])
def jobs(limit: int = Query(30, ge=1, le=200), kind: str | None = None, c: Container = Depends(container_dep)):
    return [_job(j) for j in c.jobs.list(limit, kind)]


@router.get("/jobs/{job_id}", response_model=Job)
def job(job_id: str, c: Container = Depends(container_dep)) -> Job:
    row = c.jobs.get(job_id)
    if row is None:
        raise HTTPException(404, "job not found")
    return _job(row)


@router.post("/jobs/{job_id}/cancel", response_model=Job)
def cancel(job_id: str, c: Container = Depends(container_dep)) -> Job:
    row = c.jobs.cancel(job_id)
    if row is None:
        raise HTTPException(404, "job not found")
    return _job(row)


@router.get("/stats")
def stats(c: Container = Depends(container_dep)) -> dict:
    with c.db.session() as session:
        by_status = dict(session.execute(select(DocumentRow.status, func.count()).group_by(DocumentRow.status)).all())
        by_type = dict(session.execute(select(DocumentRow.source_type, func.count())
                                       .where(DocumentRow.status == "indexed").group_by(DocumentRow.source_type)).all())
        failures = [{"id": d.id, "path": d.path, "error": d.error} for d in session.scalars(
            select(DocumentRow).where(DocumentRow.status == "failed").limit(50))]
        feedback = dict(session.execute(select(FeedbackRow.rating, func.count()).group_by(FeedbackRow.rating)).all())
    return {"documents_by_status": by_status, "documents_by_type": by_type, "recent_failures": failures,
            "feedback": {str(k): v for k, v in feedback.items()}, "vectors": c.store.count(),
            "index_version": c.platform.index_version()}
