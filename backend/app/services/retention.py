"""Data retention (docs/BUILD_SPEC.md §10.1). Runs at most daily on the scheduler leader.

* community posts removed by moderators: deleted (with their replies, reactions and reports) after
  COMMUNITY_REMOVED_RETENTION_DAYS (default 90) — long enough for appeals, then gone;
* feedback: FEEDBACK_RETENTION_DAYS (default 365);
* chat traces (only exist when STORE_CONVERSATIONS=true): CHAT_TRACE_RETENTION_DAYS (default 30);
* "I felt supported" answers: FEEDBACK_RETENTION_DAYS (aggregates stay in the anonymous ledger);
* encrypted sync blobs not updated for DEVICE_SYNC_RETENTION_DAYS (default 400).

Appeals go with their post (foreign-key cascade). The moderation ledger holds no personal data and is kept.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, or_, select

from app.db.base import Database
from app.db.models import (
    ChatTraceRow,
    CommunityPostRow,
    CommunitySurveyRow,
    FeedbackRow,
    KeyValueRow,
    SyncBlobRow,
)
from app.settings import Settings

log = logging.getLogger(__name__)
LAST_RUN_KEY = "retention.last_run"


def run_retention(settings: Settings, db: Database, now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(UTC)
    removed_cutoff = now - timedelta(days=settings.community_removed_retention_days)
    with db.session() as session:
        removed_roots = list(session.scalars(select(CommunityPostRow.id).where(
            CommunityPostRow.status == "removed", CommunityPostRow.created_at < removed_cutoff)))
        posts = session.execute(delete(CommunityPostRow).where(or_(
            CommunityPostRow.id.in_(removed_roots), CommunityPostRow.parent_id.in_(removed_roots)))).rowcount
        feedback = session.execute(delete(FeedbackRow).where(
            FeedbackRow.created_at < now - timedelta(days=settings.feedback_retention_days))).rowcount
        traces = session.execute(delete(ChatTraceRow).where(
            ChatTraceRow.created_at < now - timedelta(days=settings.chat_trace_retention_days))).rowcount
        survey = session.execute(delete(CommunitySurveyRow).where(
            CommunitySurveyRow.created_at < now - timedelta(days=settings.feedback_retention_days))).rowcount
        blobs = session.execute(delete(SyncBlobRow).where(
            SyncBlobRow.updated_at < now - timedelta(days=settings.device_sync_retention_days))).rowcount
        row = session.get(KeyValueRow, LAST_RUN_KEY)
        if row is None:
            session.add(KeyValueRow(key=LAST_RUN_KEY, value={"at": now.isoformat()}))
        else:
            row.value = {"at": now.isoformat()}
    result = {"community_posts": int(posts or 0), "feedback": int(feedback or 0), "chat_traces": int(traces or 0),
              "survey_answers": int(survey or 0), "sync_blobs": int(blobs or 0)}
    if any(result.values()):
        log.info("retention purge: %s", result)
    return result


def due(db: Database, now: datetime | None = None, every: timedelta = timedelta(hours=24)) -> bool:
    now = now or datetime.now(UTC)
    with db.session() as session:
        row = session.get(KeyValueRow, LAST_RUN_KEY)
        if row is None or not row.value.get("at"):
            return True
        last = datetime.fromisoformat(row.value["at"])
    return now - last >= every
