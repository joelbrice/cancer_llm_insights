"""Job execution entry point (called by the inline queue thread or an RQ worker process)."""

from __future__ import annotations

import logging
import traceback

log = logging.getLogger(__name__)


def run_job(job_id: str) -> None:
    from app.container import get_container

    container = get_container()
    jobs = container.jobs
    job = jobs.start(job_id)
    if job is None:
        log.info("job %s is not runnable (missing or not queued)", job_id)
        return
    progress, should_cancel = jobs.reporter(job_id)
    params = job.params or {}
    log.info("job %s (%s) started with %s", job_id, job.kind, params)
    try:
        if job.kind == "ingest":
            stats = container.ingestion.sync(params.get("source_ids"), params.get("mode", "incremental"),
                                             progress=progress, should_cancel=should_cancel)
            result = stats.as_dict()
            if stats.changed and container.settings.auto_build_insights:
                follow = jobs.submit("insights", {"force": False}, triggered_by="ingest")
                result["insights_job"] = follow.id
        elif job.kind == "insights":
            result = container.insights.build_all(params.get("topic_ids"), params.get("languages"),
                                                  bool(params.get("force")), progress=progress,
                                                  should_cancel=should_cancel).as_dict()
        elif job.kind == "evaluate":
            result = container.evaluation.run(params.get("dataset"), int(params.get("k", 8)), progress=progress)
        elif job.kind == "export_sft":
            result = container.sft_export.export(params.get("languages"), int(params.get("max_examples", 5000)),
                                                 int(params.get("distractors", 2)), progress=progress)
        else:
            raise ValueError(f"unknown job kind {job.kind}")
        if job.kind == "ingest" and job.triggered_by == "scheduler" and not result.get("changed") \
                and not result.get("errors") and not result.get("source_errors"):
            jobs.discard(job_id)  # periodic no-op sync: keep the job history meaningful
        else:
            jobs.finish(job_id, status="succeeded", stats=result)
        container.refresh_gauges()
        log.info("job %s succeeded", job_id)
    except InterruptedError:
        jobs.finish(job_id, status="cancelled")
        log.info("job %s cancelled", job_id)
    except Exception as exc:
        log.exception("job %s failed", job_id)
        jobs.finish(job_id, status="failed", error=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()[-3000:]}")
