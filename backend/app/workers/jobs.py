"""Job tracking (DB) and queue backends (inline thread pool for dev, Redis/RQ for production)."""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select

from app.core.metrics import JOBS
from app.db.base import Database
from app.db.models import JobRow, LockRow
from app.settings import Settings

log = logging.getLogger(__name__)
ACTIVE = ("queued", "running", "cancel_requested")
SINGLETON_KINDS = {"ingest", "insights"}  # never run two of these concurrently


class Queue:
    def enqueue(self, job_id: str) -> None:
        raise NotImplementedError

    def shutdown(self) -> None:
        pass


class InlineQueue(Queue):
    """Runs jobs in a single background thread of the API process (serialised, development / single node)."""

    def __init__(self, runner: Callable[[str], None]) -> None:
        self._runner = runner
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="job")

    def enqueue(self, job_id: str) -> None:
        self._pool.submit(self._runner, job_id)

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)


class RQQueue(Queue):
    """Redis-backed queue consumed by `python -m app.workers.worker` processes (horizontally scalable)."""

    def __init__(self, settings: Settings) -> None:
        from redis import Redis
        from rq import Queue as RQ

        self._queue = RQ(settings.queue_name, connection=Redis.from_url(settings.redis_url),
                         default_timeout=settings.job_timeout_seconds)

    def enqueue(self, job_id: str) -> None:
        self._queue.enqueue("app.workers.tasks.run_job", job_id, job_id=f"job-{job_id}", result_ttl=86400,
                            failure_ttl=7 * 86400)


class JobManager:
    def __init__(self, settings: Settings, db: Database) -> None:
        self.settings = settings
        self.db = db
        self.queue: Queue | None = None

    # ── submission ───────────────────────────────────────────────────────────
    def submit(self, kind: str, params: dict[str, Any] | None = None, triggered_by: str = "api") -> JobRow:
        params = params or {}
        with self.db.session() as session:
            if kind in SINGLETON_KINDS:
                active = session.scalar(select(JobRow).where(JobRow.kind == kind, JobRow.status.in_(ACTIVE))
                                        .order_by(JobRow.created_at.desc()).limit(1))
                if active is not None:
                    return active  # de-duplicate: the running job will cover this request
            job = JobRow(id=uuid.uuid4().hex[:20], kind=kind, params=params, triggered_by=triggered_by,
                         status="queued", message="Queued")
            session.add(job)
        assert self.queue is not None, "queue not configured"
        self.queue.enqueue(job.id)
        JOBS.labels(kind=kind, status="queued").inc()
        return job

    def get(self, job_id: str) -> JobRow | None:
        with self.db.session() as session:
            return session.get(JobRow, job_id)

    def list(self, limit: int = 30, kind: str | None = None) -> list[JobRow]:
        with self.db.session() as session:
            stmt = select(JobRow).order_by(JobRow.created_at.desc()).limit(limit)
            if kind:
                stmt = stmt.where(JobRow.kind == kind)
            return list(session.scalars(stmt))

    def active(self, kind: str | None = None) -> JobRow | None:
        with self.db.session() as session:
            stmt = select(JobRow).where(JobRow.status.in_(ACTIVE)).order_by(JobRow.created_at.desc()).limit(1)
            if kind:
                stmt = stmt.where(JobRow.kind == kind)
            return session.scalar(stmt)

    def cancel(self, job_id: str) -> JobRow | None:
        with self.db.session() as session:
            job = session.get(JobRow, job_id)
            if job and job.status in ("queued", "running"):
                job.status = "cancel_requested" if job.status == "running" else "cancelled"
                job.finished_at = datetime.now(UTC) if job.status == "cancelled" else None
            return job

    def recover_stale(self, older_than: timedelta = timedelta(minutes=15)) -> int:
        """Mark jobs whose worker died (no heartbeat) as failed so new work can start."""
        cutoff = datetime.now(UTC) - older_than
        n = 0
        with self.db.session() as session:
            for job in session.scalars(select(JobRow).where(JobRow.status.in_(("running", "cancel_requested")))):
                beat = job.heartbeat_at or job.started_at or job.created_at
                if beat.tzinfo is None:
                    beat = beat.replace(tzinfo=UTC)
                if beat < cutoff:
                    job.status, job.error, job.finished_at = "failed", "worker lost (no heartbeat)", datetime.now(UTC)
                    n += 1
            for job in session.scalars(select(JobRow).where(JobRow.status == "queued")):
                created = job.created_at if job.created_at.tzinfo else job.created_at.replace(tzinfo=UTC)
                if created < datetime.now(UTC) - timedelta(hours=6):
                    job.status, job.error = "failed", "never started"
                    n += 1
        return n

    # ── execution helpers (used by tasks.run_job) ────────────────────────────
    def start(self, job_id: str) -> JobRow | None:
        with self.db.session() as session:
            job = session.get(JobRow, job_id)
            if job is None or job.status not in ("queued",):
                return None
            job.status, job.started_at, job.heartbeat_at = "running", datetime.now(UTC), datetime.now(UTC)
            job.message = "Running"
            return job

    def reporter(self, job_id: str) -> tuple[Callable[[float, str], None], Callable[[], bool]]:
        last = {"t": 0.0}
        lock = threading.Lock()

        def progress(fraction: float, message: str) -> None:
            now = time.monotonic()
            with lock:
                if now - last["t"] < 1.0 and fraction < 1.0:
                    return  # throttle DB writes
                last["t"] = now
            with self.db.session() as session:
                job = session.get(JobRow, job_id)
                if job:
                    job.progress, job.message = round(max(0.0, min(1.0, fraction)), 4), message[:500]
                    job.heartbeat_at = datetime.now(UTC)

        def should_cancel() -> bool:
            with self.db.session() as session:
                job = session.get(JobRow, job_id)
                return bool(job and job.status == "cancel_requested")

        return progress, should_cancel

    def discard(self, job_id: str) -> None:
        with self.db.session() as session:
            job = session.get(JobRow, job_id)
            if job is not None:
                session.delete(job)
        JOBS.labels(kind="ingest", status="noop").inc()

    def finish(self, job_id: str, *, status: str, stats: dict[str, Any] | None = None, error: str | None = None) -> None:
        with self.db.session() as session:
            job = session.get(JobRow, job_id)
            if job is None:
                return
            job.status, job.finished_at = status, datetime.now(UTC)
            job.progress = 1.0 if status == "succeeded" else job.progress
            job.stats, job.error = stats or job.stats, error
            job.message = {"succeeded": "Completed", "failed": "Failed", "cancelled": "Cancelled"}.get(status, status)
        JOBS.labels(kind=job.kind if job else "unknown", status=status).inc()

    # ── distributed lease lock (scheduler leader election across replicas) ──
    def try_lock(self, name: str, owner: str, ttl: timedelta) -> bool:
        now = datetime.now(UTC)
        try:
            with self.db.session() as session:
                row = session.get(LockRow, name, with_for_update=True)
                if row is None:
                    session.add(LockRow(name=name, owner=owner, expires_at=now + ttl))
                    return True
                expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=UTC)
                if row.owner == owner or expires < now:
                    row.owner, row.expires_at = owner, now + ttl
                    return True
                return False
        except Exception:  # concurrent insert by another replica
            return False
