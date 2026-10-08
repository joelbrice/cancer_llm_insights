"""Quarterly community transparency report (docs/BUILD_SPEC.md §9.4) and community health metrics (§9.5).

Built from an anonymous ledger (`community_events`): each moderation step records only its kind, a reason code,
the language and, for decisions, the hours it took. No member, post or text is referenced, so the ledger is not
personal data and outlives the 90-day purge of removed posts. Small counts are suppressed (shown as "fewer than
N") so a report can never point at an individual.
"""

from __future__ import annotations

import re
import statistics
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import CommunityEventRow

EVENT_KINDS = (
    "submitted",          # a post or reply was accepted for publication or review
    "rejected",           # returned to the author before publication (e.g. contact details)
    "held",               # held for a moderator at submission (reason = screening rule)
    "reported",           # a member reported a post (reason = report reason)
    "auto_hidden",        # hidden by the report threshold pending review
    "approved",           # moderator approved (reason = why it was held; value = hours to decision)
    "removed",            # moderator removed (reason = why it was held; value = hours to decision)
    "suspended",          # member suspended (reason = strikes | manual)
    "appeal",             # an author appealed (reason = held | removed)
    "appeal_upheld",      # value = hours to decision
    "appeal_overturned",  # value = hours to decision
    "survey",             # "I felt supported" (reason = yes | somewhat | no)
)
_QUARTER = re.compile(r"^(\d{4})-Q([1-4])$")


def record(session: Session, kind: str, reason: str | None = None, language: str | None = None,
           value: float | None = None) -> None:
    assert kind in EVENT_KINDS, kind
    session.add(CommunityEventRow(kind=kind, reason=(reason or None) and reason[:32], language=language,
                                  value=value))


def hours_since(start: datetime | None, now: datetime | None = None) -> float | None:
    if start is None:
        return None
    start = start.replace(tzinfo=UTC) if start.tzinfo is None else start
    return round(((now or datetime.now(UTC)) - start).total_seconds() / 3600, 2)


def quarter_bounds(quarter: str | None, now: datetime | None = None) -> tuple[str, datetime, datetime]:
    now = now or datetime.now(UTC)
    if quarter:
        m = _QUARTER.match(quarter.strip().upper())
        if not m:
            raise ValueError("quarter must look like 2026-Q3")
        year, q = int(m.group(1)), int(m.group(2))
    else:
        year, q = now.year, (now.month - 1) // 3 + 1
    start = datetime(year, 3 * (q - 1) + 1, 1, tzinfo=UTC)
    end = datetime(year + (q == 4), (3 * q) % 12 + 1, 1, tzinfo=UTC)
    return f"{year}-Q{q}", start, end


class TransparencyReport:
    def __init__(self, min_cell: int = 5) -> None:
        self.min_cell = max(1, min_cell)

    def _cell(self, n: int) -> int | None:
        """Counts from 1 to min_cell-1 are suppressed (None → "fewer than N")."""
        return n if n == 0 or n >= self.min_cell else None

    def build(self, session: Session, quarter: str | None = None, now: datetime | None = None) -> dict[str, Any]:
        now = now or datetime.now(UTC)
        label, start, end = quarter_bounds(quarter, now)
        rows = session.execute(select(CommunityEventRow.kind, CommunityEventRow.reason, CommunityEventRow.value)
                               .where(CommunityEventRow.created_at >= start, CommunityEventRow.created_at < end)).all()
        count: dict[str, int] = {}
        by_reason: dict[str, dict[str, int]] = {}
        values: dict[str, list[float]] = {}
        for kind, reason, value in rows:
            count[kind] = count.get(kind, 0) + 1
            if reason:
                bucket = by_reason.setdefault(kind, {})
                bucket[reason] = bucket.get(reason, 0) + 1
            if value is not None:
                values.setdefault(kind, []).append(float(value))
                if reason in ("crisis", "emergency", "urgent") and kind in ("approved", "removed"):
                    values.setdefault("_safety_decision", []).append(float(value))

        def reasons(kind: str) -> dict[str, int | None]:
            return {k: self._cell(v) for k, v in sorted(by_reason.get(kind, {}).items())}

        def median(key: str) -> float | None:
            data = values.get(key, [])
            return round(statistics.median(data), 1) if len(data) >= self.min_cell else None

        decisions = values.get("approved", []) + values.get("removed", [])
        survey = by_reason.get("survey", {})
        responses = sum(survey.values())
        first = session.scalar(select(func.min(CommunityEventRow.created_at)))
        return {
            "quarter": label,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "complete": now >= end,
            "generated_at": now.isoformat(),
            "min_cell": self.min_cell,
            "available": self.quarters(first, now),
            "posts": {
                "submitted": self._cell(count.get("submitted", 0)),
                "held_for_review": self._cell(count.get("held", 0)),
                "returned_to_author": self._cell(count.get("rejected", 0)),
                "hidden_after_reports": self._cell(count.get("auto_hidden", 0)),
            },
            "held_by_reason": reasons("held"),
            "returned_by_reason": reasons("rejected"),
            "reports_by_reason": reasons("reported"),
            "decisions": {
                "approved": self._cell(count.get("approved", 0)),
                "removed": self._cell(count.get("removed", 0)),
                "removed_by_reason": reasons("removed"),
                "median_hours_to_decision": (round(statistics.median(decisions), 1)
                                             if len(decisions) >= self.min_cell else None),
                "median_hours_safety_items": median("_safety_decision"),
            },
            "appeals": {
                "received": self._cell(count.get("appeal", 0)),
                "overturned": self._cell(count.get("appeal_overturned", 0)),
                "upheld": self._cell(count.get("appeal_upheld", 0)),
            },
            "suspensions": self._cell(count.get("suspended", 0)),
            "felt_supported": ({"responses": responses,
                                **{k: round(survey.get(k, 0) / responses, 3) for k in ("yes", "somewhat", "no")}}
                               if responses >= self.min_cell else None),
        }

    @staticmethod
    def quarters(first: datetime | None, now: datetime) -> list[str]:
        """Quarters with data, newest first (at most 12)."""
        if first is None:
            return [quarter_bounds(None, now)[0]]
        first = first.replace(tzinfo=UTC) if first.tzinfo is None else first
        out: list[str] = []
        label, start, _ = quarter_bounds(None, now)
        while len(out) < 12:
            out.append(label)
            if start <= first:
                break
            label, start, _ = quarter_bounds(None, start - timedelta(days=1))
        return out


def health(session: Session, now: datetime | None = None, days: int = 30) -> dict[str, Any]:
    """Moderator-facing health metrics (§9.5) over the last `days` days. Not engagement metrics."""
    now = now or datetime.now(UTC)
    since = now - timedelta(days=days)
    rows = session.execute(select(CommunityEventRow.kind, CommunityEventRow.value)
                           .where(CommunityEventRow.created_at >= since)).all()
    count: dict[str, int] = {}
    decision_hours: list[float] = []
    for kind, value in rows:
        count[kind] = count.get(kind, 0) + 1
        if kind in ("approved", "removed") and value is not None:
            decision_hours.append(float(value))
    submitted = count.get("submitted", 0)
    return {
        "window_days": days,
        "submitted": submitted,
        "held_share": round(count.get("held", 0) / submitted, 3) if submitted else None,
        "reports_per_100_posts": round(100 * count.get("reported", 0) / submitted, 1) if submitted else None,
        "median_hours_to_decision": round(statistics.median(decision_hours), 1) if decision_hours else None,
        "appeals": count.get("appeal", 0),
    }
