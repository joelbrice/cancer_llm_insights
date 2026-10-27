"""Community service: membership, feed, threads, reactions, reports, moderation, export and erasure."""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.community import transparency
from app.community.moderation import CommunityConfig, CommunityModerator, Screening, handle_key
from app.core.language import detect_language
from app.core.metrics import COMMUNITY_POSTS, SAFETY_TRIGGERS
from app.db.base import Database
from app.db.models import (
    CommunityAppealRow,
    CommunityBlockRow,
    CommunityMemberRow,
    CommunityPostRow,
    CommunityReactionRow,
    CommunityReportRow,
    CommunitySurveyRow,
    InsightRow,
)
from app.schemas.api import RelatedInsight
from app.schemas.community import (
    ActivityItem,
    Appeal,
    AppealQueueItem,
    AppealResult,
    Author,
    BlockedMember,
    CircleInfo,
    CommunityMeta,
    Member,
    MemberActivity,
    MemberCreate,
    MemberMe,
    MemberSession,
    MemberUpdate,
    ModeratedPost,
    ModerationOutcome,
    Post,
    PostCreate,
    PostPage,
    PostResult,
    PostThread,
    QueueItem,
    ReactionResult,
    ReplyCreate,
    ReportCreate,
    SurveyStatus,
)
from app.settings import Settings

log = logging.getLogger(__name__)


class CommunityError(Exception):
    def __init__(self, status: int, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.status, self.code, self.message = status, code, message or code


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(12)}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _encode_cursor(post: CommunityPostRow) -> str:
    raw = f"{_aware(post.created_at).isoformat()}|{post.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        stamp, post_id = raw.split("|", 1)
        return datetime.fromisoformat(stamp), post_id
    except Exception as exc:
        raise CommunityError(400, "bad_cursor") from exc


class CommunityService:
    def __init__(self, settings: Settings, db: Database, moderator: CommunityModerator, insights) -> None:
        self.settings = settings
        self.db = db
        self.moderator = moderator
        self.config: CommunityConfig = moderator.config
        self.insights = insights

    # ── metadata ──────────────────────────────────────────────────────────────────
    def meta(self, lang: str) -> CommunityMeta:
        week = _now().isocalendar().week
        s = self.settings
        circles = [
            CircleInfo(id=c["id"], icon=c["icon"], audience=c["audience"],
                       title=self.config.localized(c, "title", lang),
                       description=self.config.localized(c, "description", lang),
                       prompt=self.config.prompt(c["id"], lang, week))
            for c in self.config.circles.values()
        ]
        return CommunityMeta(
            enabled=s.community_enabled, guidelines_version=self.config.guidelines_version,
            min_age=s.community_min_age, circles=circles, kinds=self.config.kinds,
            reactions=self.config.reactions, report_reasons=self.config.report_reasons,
            limits={"post_chars": 2000, "reply_chars": 1000, "posts_per_hour": s.community_posts_per_hour,
                    "replies_per_hour": s.community_replies_per_hour},
        )

    # ── membership ────────────────────────────────────────────────────────────────
    def join(self, body: MemberCreate) -> MemberSession:
        if not (body.accept_guidelines and body.confirm_age and body.consent_health_data):
            raise CommunityError(422, "consent_required", "guidelines, age and consent must all be confirmed")
        lang = self._language(body.language)
        error = self.moderator.check_handle(body.handle)
        if error:
            raise CommunityError(422, error)
        token = secrets.token_urlsafe(32)
        row = CommunityMemberRow(id=_new_id("m"), handle=body.handle, handle_key=handle_key(body.handle),
                                 token_hash=hash_token(token), language=lang, journey=body.journey,
                                 guidelines_version=self.config.guidelines_version)
        try:
            with self.db.session() as session:
                session.add(row)
        except IntegrityError as exc:
            raise CommunityError(409, "handle_taken") from exc
        return MemberSession(member=self._member(row), token=token)

    def authenticate(self, token: str | None) -> CommunityMemberRow:
        if not token:
            raise CommunityError(401, "member_token_required")
        with self.db.session() as session:
            row = session.scalar(select(CommunityMemberRow).where(CommunityMemberRow.token_hash == hash_token(token)))
        if row is None:
            raise CommunityError(401, "invalid_member_token")
        if row.status == "banned":
            raise CommunityError(403, "member_banned")
        return row

    def me(self, member: CommunityMemberRow) -> MemberMe:
        return MemberMe(member=self._member(member), activity=self._activity(member))

    def mark_seen(self, member: CommunityMemberRow) -> None:
        with self.db.session() as session:
            row = session.get(CommunityMemberRow, member.id)
            if row is not None:
                row.last_seen_at = _now()

    def update_member(self, member: CommunityMemberRow, body: MemberUpdate) -> Member:
        with self.db.session() as session:
            row = session.get(CommunityMemberRow, member.id)
            assert row is not None
            if body.handle is not None:
                handle = " ".join(body.handle.split())
                error = self.moderator.check_handle(handle)
                if error:
                    raise CommunityError(422, error)
                row.handle, row.handle_key = handle, handle_key(handle)
            if body.language is not None:
                row.language = self._language(body.language)
            if body.journey is not None:
                row.journey = body.journey
            if body.clear_journey:
                row.journey = None
            try:
                session.flush()
            except IntegrityError as exc:
                raise CommunityError(409, "handle_taken") from exc
            return self._member(row)

    def export(self, member: CommunityMemberRow) -> dict[str, Any]:
        """Everything stored about the member (GDPR Art. 15 & 20)."""
        with self.db.session() as session:
            posts = session.scalars(select(CommunityPostRow).where(CommunityPostRow.member_id == member.id)
                                    .order_by(CommunityPostRow.created_at)).all()
            reactions = session.scalars(select(CommunityReactionRow)
                                        .where(CommunityReactionRow.member_id == member.id)).all()
            reports = session.scalars(select(CommunityReportRow)
                                      .where(CommunityReportRow.member_id == member.id)).all()
            blocks = self.blocks(member)
            appeals = session.scalars(select(CommunityAppealRow).where(CommunityAppealRow.member_id == member.id)
                                      .order_by(CommunityAppealRow.created_at)).all()
            survey = session.scalars(select(CommunitySurveyRow).where(CommunitySurveyRow.member_id == member.id)
                                     .order_by(CommunitySurveyRow.created_at)).all()
        return {
            "exported_at": _now().isoformat(),
            "member": self._member(member).model_dump(mode="json"),
            "posts": [{"id": p.id, "parent_id": p.parent_id, "circle": p.circle, "kind": p.kind,
                       "language": p.language, "body": p.body, "status": p.status,
                       "created_at": _aware(p.created_at).isoformat()} for p in posts],
            "reactions": [{"post_id": r.post_id, "kind": r.kind, "created_at": _aware(r.created_at).isoformat()}
                          for r in reactions],
            "reports": [{"post_id": r.post_id, "reason": r.reason, "created_at": _aware(r.created_at).isoformat()}
                        for r in reports],
            "blocked_members": [b.handle for b in blocks],
            "appeals": [self._appeal(a).model_dump(mode="json") for a in appeals],
            "survey_answers": [{"answer": r.answer, "created_at": _aware(r.created_at).isoformat()} for r in survey],
            "not_stored": "No name, email address, IP address or device identifier is stored.",
        }

    def erase(self, member: CommunityMemberRow) -> None:
        """Right to erasure: the account, reactions and reports go; the member's words are deleted. A deleted
        opening post that others replied to stays as an empty placeholder so their replies keep their context."""
        with self.db.session() as session:
            posts = session.scalars(select(CommunityPostRow).where(CommunityPostRow.member_id == member.id)).all()
            parents_touched: set[str] = set()
            for post in posts:
                has_replies = post.parent_id is None and session.scalar(
                    select(func.count()).select_from(CommunityPostRow)
                    .where(CommunityPostRow.parent_id == post.id, CommunityPostRow.member_id != member.id)) > 0
                if has_replies:
                    post.body, post.status, post.member_id, post.related_insight_id = "", "deleted", None, None
                else:
                    if post.parent_id:
                        parents_touched.add(post.parent_id)
                    session.delete(post)
            row = session.get(CommunityMemberRow, member.id)
            if row is not None:
                session.delete(row)
            session.flush()
            for parent_id in parents_touched:
                self._refresh_reply_count(session, parent_id)

    # ── posting ───────────────────────────────────────────────────────────────────
    def create_post(self, member: CommunityMemberRow, body: PostCreate, country: str | None = None) -> PostResult:
        self._require_active(member)
        if body.circle not in self.config.circles:
            raise CommunityError(422, "unknown_circle")
        self._rate_check(member, replies=False)
        lang = self._detect(body.body, body.language or member.language)
        screening = self._first_posts_rule(member, self._screen(body.body, lang, country))
        audience = self.config.circles[body.circle]["audience"]
        related = None
        if screening.action == "publish":
            related = self.insights.match_text(body.body, lang, audience)
        row = CommunityPostRow(
            id=_new_id("p"), member_id=member.id, parent_id=None, circle=body.circle, kind=body.kind, language=lang,
            body=body.body.strip(), status="published" if screening.action == "publish" else "held",
            flags=screening.flags, notes=screening.notes,
            moderation={"auto": screening.reason, "priority": screening.priority},
            related_insight_id=related.id if related else None,
        )
        with self.db.session() as session:
            session.add(row)
            self._ledger_submission(session, row, screening)
        self._count(row, screening)
        return PostResult(post=self._post(row, member), moderation=self._outcome(row, screening))

    def reply(self, member: CommunityMemberRow, post_id: str, body: ReplyCreate,
              country: str | None = None) -> PostResult:
        self._require_active(member)
        with self.db.session() as session:
            parent = session.get(CommunityPostRow, post_id)
            if parent is None or parent.parent_id is not None or parent.status != "published" \
                    or parent.member_id in self._hidden_authors(session, member.id):
                raise CommunityError(404, "post_not_found")
            circle = parent.circle
        self._rate_check(member, replies=True)
        lang = self._detect(body.body, body.language or member.language)
        screening = self._first_posts_rule(member, self._screen(body.body, lang, country))
        row = CommunityPostRow(
            id=_new_id("p"), member_id=member.id, parent_id=post_id, circle=circle, kind="reply", language=lang,
            body=body.body.strip(), status="published" if screening.action == "publish" else "held",
            flags=screening.flags, notes=screening.notes,
            moderation={"auto": screening.reason, "priority": screening.priority},
        )
        with self.db.session() as session:
            session.add(row)
            self._ledger_submission(session, row, screening)
            session.flush()
            self._refresh_reply_count(session, post_id)
        self._count(row, screening)
        return PostResult(post=self._post(row, member), moderation=self._outcome(row, screening))

    def edit(self, member: CommunityMemberRow, post_id: str, text: str, country: str | None = None) -> PostResult:
        self._require_active(member)
        with self.db.session() as session:
            row = session.get(CommunityPostRow, post_id)
            if row is None or row.member_id != member.id or row.status in ("removed", "deleted"):
                raise CommunityError(404, "post_not_found")
            limit = 1000 if row.parent_id else 2000
            if len(text) > limit:
                raise CommunityError(422, "too_long")
            screening = self._screen(text, row.language, country)
            if row.status == "held" and screening.action == "publish":
                screening = Screening("hold", reason=row.moderation.get("auto"), flags=row.flags)  # still pending
            row.body, row.edited_at = text.strip(), _now()
            row.status = "published" if screening.action == "publish" else "held"
            row.flags, row.notes = screening.flags, screening.notes
            row.moderation = {**row.moderation, "auto": screening.reason, "priority": screening.priority}
            if row.parent_id is None:
                related = self.insights.match_text(text, row.language,
                                                   self.config.circles.get(row.circle, {}).get("audience"))
                row.related_insight_id = related.id if related and row.status == "published" else None
            session.flush()
            if row.parent_id:
                self._refresh_reply_count(session, row.parent_id)
            return PostResult(post=self._post(row, member), moderation=self._outcome(row, screening))

    def delete_post(self, member: CommunityMemberRow, post_id: str) -> None:
        with self.db.session() as session:
            row = session.get(CommunityPostRow, post_id)
            if row is None or row.member_id != member.id:
                raise CommunityError(404, "post_not_found")
            has_replies = row.parent_id is None and row.reply_count > 0
            if has_replies:
                row.body, row.status, row.related_insight_id = "", "deleted", None
            else:
                parent_id = row.parent_id
                session.delete(row)
                session.flush()
                if parent_id:
                    self._refresh_reply_count(session, parent_id)

    # ── reading ───────────────────────────────────────────────────────────────────
    def feed(self, member: CommunityMemberRow, *, circle: str | None, kind: str | None, language: str | None,
             cursor: str | None, limit: int = 20) -> PostPage:
        limit = max(1, min(limit, 50))
        with self.db.session() as session:
            visible = or_(CommunityPostRow.status == "published",
                          and_(CommunityPostRow.status == "held", CommunityPostRow.member_id == member.id))
            stmt = select(CommunityPostRow).where(CommunityPostRow.parent_id.is_(None), visible)
            if circle:
                stmt = stmt.where(CommunityPostRow.circle == circle)
            if kind:
                stmt = stmt.where(CommunityPostRow.kind == kind)
            if language:
                stmt = stmt.where(CommunityPostRow.language == language)
            hidden = self._hidden_authors(session, member.id)
            if hidden:
                stmt = stmt.where(or_(CommunityPostRow.member_id.is_(None), CommunityPostRow.member_id.not_in(hidden)))
            if cursor:
                stamp, post_id = _decode_cursor(cursor)
                stmt = stmt.where(or_(CommunityPostRow.created_at < stamp,
                                      and_(CommunityPostRow.created_at == stamp, CommunityPostRow.id < post_id)))
            rows = session.scalars(stmt.order_by(CommunityPostRow.created_at.desc(), CommunityPostRow.id.desc())
                                   .limit(limit + 1)).all()
            page = rows[:limit]
            items = self._posts(session, page, member)
        return PostPage(items=items, next_cursor=_encode_cursor(page[-1]) if len(rows) > limit else None)

    def thread(self, member: CommunityMemberRow, post_id: str) -> PostThread:
        with self.db.session() as session:
            root = session.get(CommunityPostRow, post_id)
            hidden = self._hidden_authors(session, member.id)
            if root is None or root.parent_id is not None or not self._visible(root, member, thread=True) \
                    or root.member_id in hidden:
                raise CommunityError(404, "post_not_found")
            replies = session.scalars(select(CommunityPostRow).where(CommunityPostRow.parent_id == post_id)
                                      .order_by(CommunityPostRow.created_at, CommunityPostRow.id)).all()
            replies = [r for r in replies if self._visible(r, member) and r.member_id not in hidden]
            posts = self._posts(session, [root, *replies], member)
        return PostThread(post=posts[0], replies=posts[1:])

    # ── reactions & reports ───────────────────────────────────────────────────────
    def react(self, member: CommunityMemberRow, post_id: str, kind: str, on: bool) -> ReactionResult:
        self._require_active(member)
        if kind not in self.config.reactions:
            raise CommunityError(422, "unknown_reaction")
        with self.db.session() as session:
            post = session.get(CommunityPostRow, post_id)
            if post is None or post.status != "published":
                raise CommunityError(404, "post_not_found")
            existing = session.scalar(select(CommunityReactionRow).where(
                CommunityReactionRow.post_id == post_id, CommunityReactionRow.member_id == member.id,
                CommunityReactionRow.kind == kind))
            if on and existing is None:
                recent = session.scalar(select(func.count()).select_from(CommunityReactionRow).where(
                    CommunityReactionRow.member_id == member.id,
                    CommunityReactionRow.created_at >= _now() - timedelta(hours=1)))
                if recent >= self.settings.community_reactions_per_hour:
                    raise CommunityError(429, "slow_down")
                session.add(CommunityReactionRow(post_id=post_id, member_id=member.id, kind=kind))
            elif not on and existing is not None:
                session.delete(existing)
            session.flush()
            post.reaction_counts = self._reaction_counts(session, post_id)
            mine = list(session.scalars(select(CommunityReactionRow.kind).where(
                CommunityReactionRow.post_id == post_id, CommunityReactionRow.member_id == member.id)))
            return ReactionResult(reactions=post.reaction_counts, my_reactions=sorted(mine))

    def report(self, member: CommunityMemberRow, post_id: str, body: ReportCreate) -> None:
        with self.db.session() as session:
            post = session.get(CommunityPostRow, post_id)
            if post is None or post.status not in ("published", "held"):
                raise CommunityError(404, "post_not_found")
            if post.member_id == member.id:
                raise CommunityError(422, "cannot_report_own_post")
            today = session.scalar(select(func.count()).select_from(CommunityReportRow).where(
                CommunityReportRow.member_id == member.id,
                CommunityReportRow.created_at >= _now() - timedelta(days=1)))
            if today >= self.settings.community_reports_per_day:
                raise CommunityError(429, "slow_down")
            exists = session.scalar(select(CommunityReportRow).where(
                CommunityReportRow.post_id == post_id, CommunityReportRow.member_id == member.id))
            if exists is not None:
                return  # idempotent
            session.add(CommunityReportRow(id=_new_id("r"), post_id=post_id, member_id=member.id,
                                           reason=body.reason, note=body.note))
            transparency.record(session, "reported", body.reason, post.language)
            session.flush()
            post.report_count = int(session.scalar(select(func.count()).select_from(CommunityReportRow).where(
                CommunityReportRow.post_id == post_id, CommunityReportRow.status == "open")) or 0)
            mod = dict(post.moderation or {})
            if body.reason == "crisis":
                mod["priority"] = max(int(mod.get("priority", 0)), 2)  # someone may need help: review first
            if post.status == "published" and post.report_count >= self.settings.community_report_threshold:
                post.status = "held"
                post.flags = [*post.flags, "reported"]
                mod["auto"] = "reported"
                transparency.record(session, "auto_hidden", None, post.language)
            post.moderation = mod
            if post.parent_id:
                session.flush()
                self._refresh_reply_count(session, post.parent_id)

    # ── blocking (App Store 1.2 / Play UGC policy) ────────────────────────────────
    def block_author(self, member: CommunityMemberRow, post_id: str) -> BlockedMember:
        with self.db.session() as session:
            post = session.get(CommunityPostRow, post_id)
            if post is None or post.member_id is None:
                raise CommunityError(404, "post_not_found")
            if post.member_id == member.id:
                raise CommunityError(422, "cannot_block_self")
            row = session.scalar(select(CommunityBlockRow).where(
                CommunityBlockRow.member_id == member.id, CommunityBlockRow.blocked_id == post.member_id))
            if row is None:
                row = CommunityBlockRow(member_id=member.id, blocked_id=post.member_id)
                session.add(row)
                session.flush()
            blocked = session.get(CommunityMemberRow, post.member_id)
            return BlockedMember(id=str(row.id), handle=blocked.handle if blocked else "",
                                 created_at=_aware(row.created_at) or _now())

    def blocks(self, member: CommunityMemberRow) -> list[BlockedMember]:
        with self.db.session() as session:
            rows = session.execute(select(CommunityBlockRow, CommunityMemberRow.handle).join(
                CommunityMemberRow, CommunityMemberRow.id == CommunityBlockRow.blocked_id).where(
                CommunityBlockRow.member_id == member.id).order_by(CommunityBlockRow.created_at.desc())).all()
        return [BlockedMember(id=str(b.id), handle=handle, created_at=_aware(b.created_at) or _now()) for b, handle in rows]

    def unblock(self, member: CommunityMemberRow, block_id: str) -> None:
        with self.db.session() as session:
            row = session.get(CommunityBlockRow, int(block_id)) if block_id.isdigit() else None
            if row is None or row.member_id != member.id:
                raise CommunityError(404, "block_not_found")
            session.delete(row)

    @staticmethod
    def _hidden_authors(session: Session, member_id: str) -> set[str]:
        """Members whose content this member must not see: those they blocked and those who blocked them."""
        out = set(session.scalars(select(CommunityBlockRow.blocked_id).where(CommunityBlockRow.member_id == member_id)))
        out |= set(session.scalars(select(CommunityBlockRow.member_id).where(CommunityBlockRow.blocked_id == member_id)))
        return out

    # ── moderation (admin) ────────────────────────────────────────────────────────
    def queue(self, limit: int = 100) -> list[QueueItem]:
        with self.db.session() as session:
            reported_ids = set(session.scalars(select(CommunityReportRow.post_id)
                                               .where(CommunityReportRow.status == "open")))
            rows = session.scalars(select(CommunityPostRow).where(or_(
                CommunityPostRow.status == "held",
                and_(CommunityPostRow.status == "published", CommunityPostRow.id.in_(reported_ids or {""}))))).all()
            rows = sorted(rows, key=lambda r: (-int((r.moderation or {}).get("priority", 0)), -r.report_count,
                                               _aware(r.created_at)))[:limit]
            reports: dict[str, list[dict]] = {}
            for rep in session.scalars(select(CommunityReportRow).where(
                    CommunityReportRow.post_id.in_([r.id for r in rows] or [""]), CommunityReportRow.status == "open")):
                reports.setdefault(rep.post_id, []).append(
                    {"reason": rep.reason, "note": rep.note, "created_at": _aware(rep.created_at).isoformat()})
            appeals = {a.post_id: self._appeal(a) for a in session.scalars(select(CommunityAppealRow).where(
                CommunityAppealRow.post_id.in_([r.id for r in rows] or [""]), CommunityAppealRow.status == "open"))}
            posts = self._posts(session, rows, None)
            return [QueueItem(post=p, member_id=r.member_id, flags=r.flags, moderation=r.moderation or {},
                              reports=reports.get(r.id, []), appeal=appeals.get(r.id))
                    for p, r in zip(posts, rows, strict=True)]

    def decide(self, post_id: str, action: str, note: str | None, *, ledger: bool = True) -> Post:
        with self.db.session() as session:
            post = session.get(CommunityPostRow, post_id)
            if post is None or post.status == "deleted":
                raise CommunityError(404, "post_not_found")
            if ledger:  # appeal outcomes are counted as appeals, not as first decisions
                transparency.record(session, "approved" if action == "approve" else "removed",
                                    (post.moderation or {}).get("auto") or "reported", post.language,
                                    transparency.hours_since(post.created_at))
            post.status = "published" if action == "approve" else "removed"
            post.moderation = {**(post.moderation or {}), "decision": action, "note": note,
                               "decided_at": _now().isoformat()}
            if action == "approve" and post.parent_id is None and post.related_insight_id is None:
                related = self.insights.match_text(post.body, post.language,
                                                   self.config.circles.get(post.circle, {}).get("audience"))
                post.related_insight_id = related.id if related else None
            for rep in session.scalars(select(CommunityReportRow).where(
                    CommunityReportRow.post_id == post_id, CommunityReportRow.status == "open")):
                rep.status, rep.resolved_at = "resolved", _now()
            post.report_count = 0
            if action == "remove" and post.member_id:
                author = session.get(CommunityMemberRow, post.member_id)
                if author is not None:
                    author.strikes += 1
                    if author.strikes >= self.settings.community_strikes_to_suspend and author.status == "active":
                        author.status = "suspended"
                        transparency.record(session, "suspended", "strikes")
            session.flush()
            if post.parent_id:
                self._refresh_reply_count(session, post.parent_id)
            return self._posts(session, [post], None)[0]

    def set_member_status(self, member_id: str, status: str) -> Member:
        with self.db.session() as session:
            row = session.get(CommunityMemberRow, member_id)
            if row is None:
                raise CommunityError(404, "member_not_found")
            if status != "active" and row.status == "active":
                transparency.record(session, "suspended", "manual")
            row.status = status
            if status == "active":
                row.strikes = 0
            return self._member(row)

    def stats(self) -> dict[str, Any]:
        with self.db.session() as session:
            def count(model, *conds) -> int:
                return int(session.scalar(select(func.count()).select_from(model).where(*conds)) or 0)

            week = _now() - timedelta(days=7)
            return {
                "members": count(CommunityMemberRow),
                "members_active_7d": count(CommunityMemberRow, CommunityMemberRow.last_seen_at >= week),
                "posts_published": count(CommunityPostRow, CommunityPostRow.status == "published"),
                "posts_held": count(CommunityPostRow, CommunityPostRow.status == "held"),
                "posts_removed": count(CommunityPostRow, CommunityPostRow.status == "removed"),
                "posts_7d": count(CommunityPostRow, CommunityPostRow.created_at >= week),
                "open_reports": count(CommunityReportRow, CommunityReportRow.status == "open"),
                "suspended_members": count(CommunityMemberRow, CommunityMemberRow.status != "active"),
                "open_appeals": count(CommunityAppealRow, CommunityAppealRow.status == "open"),
                "health": {**transparency.health(session), "answered_within_24h": self._answered_share(session)},
                "felt_supported_90d": self._survey_summary(session),
            }

    # ── appeals (authors see why; the community lead decides) ─────────────────────
    def my_moderation(self, member: CommunityMemberRow, limit: int = 50) -> list[ModeratedPost]:
        """The member's own held or removed posts, with the reason and any appeal."""
        with self.db.session() as session:
            rows = session.scalars(select(CommunityPostRow).where(
                CommunityPostRow.member_id == member.id, CommunityPostRow.status.in_(("held", "removed")))
                .order_by(CommunityPostRow.created_at.desc()).limit(limit)).all()
            appeals = {a.post_id: a for a in session.scalars(select(CommunityAppealRow).where(
                CommunityAppealRow.post_id.in_([r.id for r in rows] or [""])))}
            posts = self._posts(session, rows, member)
        out = []
        for post, row in zip(posts, rows, strict=True):
            mod = row.moderation or {}
            decided = mod.get("decided_at")
            appeal = appeals.get(row.id)
            out.append(ModeratedPost(
                post=post, reason=mod.get("auto"), decision=mod.get("decision") if row.status == "removed" else None,
                decided_at=datetime.fromisoformat(decided) if decided and row.status == "removed" else None,
                can_appeal=appeal is None, appeal=self._appeal(appeal) if appeal else None))
        return out

    def appeal(self, member: CommunityMemberRow, post_id: str, text: str, country: str | None = None) -> AppealResult:
        """One appeal per post. Suspended members can appeal. The text is private to moderators but is still
        screened: contact details are refused, and someone in crisis gets help immediately."""
        text = text.strip()
        screening = self.moderator.screen(text, member.language, country)
        if screening.action == "reject":
            raise CommunityError(422, screening.reason or "rejected")
        with self.db.session() as session:
            post = session.get(CommunityPostRow, post_id)
            if post is None or post.member_id != member.id or post.status not in ("held", "removed"):
                raise CommunityError(404, "post_not_found")
            if session.scalar(select(CommunityAppealRow).where(CommunityAppealRow.post_id == post_id)) is not None:
                raise CommunityError(409, "already_appealed")
            row = CommunityAppealRow(id=_new_id("a"), post_id=post_id, member_id=member.id, text=text,
                                     post_status=post.status, priority=screening.priority)
            session.add(row)
            transparency.record(session, "appeal", post.status, post.language)
            try:
                session.flush()
            except IntegrityError as exc:  # concurrent duplicate
                raise CommunityError(409, "already_appealed") from exc
            return AppealResult(appeal=self._appeal(row), safety=screening.safety)

    def appeals(self, status: str | None = "open", limit: int = 100) -> list[AppealQueueItem]:
        with self.db.session() as session:
            stmt = select(CommunityAppealRow)
            if status:
                stmt = stmt.where(CommunityAppealRow.status == status)
            rows = session.scalars(stmt.order_by(CommunityAppealRow.priority.desc(),
                                                 CommunityAppealRow.created_at).limit(limit)).all()
            posts = {p.id: p for p in session.scalars(select(CommunityPostRow).where(
                CommunityPostRow.id.in_([a.post_id for a in rows] or [""])))}
            rendered = {p.id: p for p in self._posts(session, list(posts.values()), None)}
            return [AppealQueueItem(appeal=self._appeal(a), post=rendered[a.post_id],
                                    member_id=posts[a.post_id].member_id, moderation=posts[a.post_id].moderation or {},
                                    priority=a.priority) for a in rows if a.post_id in rendered]

    def decide_appeal(self, appeal_id: str, action: str, response: str | None) -> Appeal:
        """Overturn → the post is published and a strike from its removal is refunded (an automatic suspension
        that no longer meets the threshold is lifted). Uphold → a still-held post is removed; a removed one stays."""
        with self.db.session() as session:
            appeal = session.get(CommunityAppealRow, appeal_id)
            if appeal is None:
                raise CommunityError(404, "appeal_not_found")
            if appeal.status != "open":
                raise CommunityError(409, "appeal_already_decided")
            post = session.get(CommunityPostRow, appeal.post_id)
            post_status, post_id, author_id = (post.status if post else None), appeal.post_id, appeal.member_id
            hours = transparency.hours_since(appeal.created_at)
        if post_status not in ("held", "removed"):
            raise CommunityError(409, "post_changed")
        if action == "overturn":
            self.decide(post_id, "approve", f"appeal overturned: {response or ''}".strip(), ledger=False)
            if post_status == "removed":
                self._refund_strike(author_id)
        elif post_status == "held":
            self.decide(post_id, "remove", f"appeal upheld: {response or ''}".strip(), ledger=False)
        with self.db.session() as session:
            appeal = session.get(CommunityAppealRow, appeal_id)
            assert appeal is not None
            appeal.status = "overturned" if action == "overturn" else "upheld"
            appeal.response, appeal.decided_at = response, _now()
            transparency.record(session, f"appeal_{appeal.status}", appeal.post_status, None, hours)
            session.flush()
            return self._appeal(appeal)

    def _refund_strike(self, member_id: str) -> None:
        with self.db.session() as session:
            author = session.get(CommunityMemberRow, member_id)
            if author is None or author.strikes <= 0:
                return
            was_at_threshold = author.strikes >= self.settings.community_strikes_to_suspend
            author.strikes -= 1
            if author.status == "suspended" and was_at_threshold \
                    and author.strikes < self.settings.community_strikes_to_suspend:
                author.status = "active"

    @staticmethod
    def _appeal(row: CommunityAppealRow) -> Appeal:
        return Appeal(id=row.id, post_id=row.post_id, text=row.text, post_status=row.post_status,  # type: ignore[arg-type]
                      status=row.status, response=row.response,  # type: ignore[arg-type]
                      created_at=_aware(row.created_at) or _now(), decided_at=_aware(row.decided_at))

    # ── "I felt supported" (opt-in, at most monthly) ──────────────────────────────
    def survey_status(self, member: CommunityMemberRow) -> SurveyStatus:
        with self.db.session() as session:
            last = session.scalar(select(func.max(CommunitySurveyRow.created_at))
                                  .where(CommunitySurveyRow.member_id == member.id))
        last = _aware(last)
        joined = _aware(member.created_at) or _now()
        due = (_now() - joined >= timedelta(days=self.settings.community_survey_min_days)
               and (last is None or _now() - last >= timedelta(days=self.settings.community_survey_interval_days)))
        return SurveyStatus(due=due, last_answered_at=last)

    def answer_survey(self, member: CommunityMemberRow, answer: str) -> SurveyStatus:
        if not self.survey_status(member).due:
            raise CommunityError(409, "survey_not_due")
        with self.db.session() as session:
            session.add(CommunitySurveyRow(member_id=member.id, answer=answer, journey=member.journey,
                                           language=member.language))
            transparency.record(session, "survey", answer, member.language)
        return self.survey_status(member)

    @staticmethod
    def _survey_summary(session: Session, days: int = 90) -> dict[str, Any]:
        rows = dict(session.execute(select(CommunitySurveyRow.answer, func.count()).where(
            CommunitySurveyRow.created_at >= _now() - timedelta(days=days)).group_by(CommunitySurveyRow.answer)).all())
        total = sum(rows.values())
        return {"responses": total, **{k: (round(rows.get(k, 0) / total, 3) if total else None)
                                       for k in ("yes", "somewhat", "no")}}

    @staticmethod
    def _answered_share(session: Session, days: int = 30) -> float | None:
        """Share of opening posts (older than 24 h, from the last `days` days) that received a reaction or a
        published reply from someone else within 24 hours."""
        now = _now()
        roots = session.scalars(select(CommunityPostRow).where(
            CommunityPostRow.parent_id.is_(None), CommunityPostRow.status == "published",
            CommunityPostRow.created_at >= now - timedelta(days=days),
            CommunityPostRow.created_at <= now - timedelta(hours=24)).limit(2000)).all()
        if not roots:
            return None
        answered = 0
        for root in roots:
            created = _aware(root.created_at)
            window = (CommunityPostRow.created_at <= created + timedelta(hours=24))
            replied = session.scalar(select(func.count()).select_from(CommunityPostRow).where(
                CommunityPostRow.parent_id == root.id, CommunityPostRow.status == "published",
                CommunityPostRow.member_id != root.member_id, window))
            reacted = 0 if replied else session.scalar(select(func.count()).select_from(CommunityReactionRow).where(
                CommunityReactionRow.post_id == root.id, CommunityReactionRow.member_id != root.member_id,
                CommunityReactionRow.created_at <= created + timedelta(hours=24)))
            answered += 1 if replied or reacted else 0
        return round(answered / len(roots), 3)

    # ── public transparency report ────────────────────────────────────────────────
    def transparency(self, quarter: str | None = None) -> dict[str, Any]:
        try:
            with self.db.session() as session:
                return transparency.TransparencyReport(self.settings.transparency_min_cell).build(session, quarter)
        except ValueError as exc:
            raise CommunityError(422, "bad_quarter") from exc

    # ── helpers ───────────────────────────────────────────────────────────────────
    @staticmethod
    def _ledger_submission(session: Session, row: CommunityPostRow, screening: Screening) -> None:
        transparency.record(session, "submitted", None, row.language)
        if row.status == "held":
            transparency.record(session, "held", screening.reason or "held", row.language)

    def _screen(self, text: str, lang: str, country: str | None) -> Screening:
        """Screen + metrics. Rejections raise; holds and notes are returned for the caller to store."""
        screening = self.moderator.screen(text, lang, country)
        for rule in screening.flags:
            SAFETY_TRIGGERS.labels(rule=rule, language=lang, surface="community").inc()
        if screening.action == "reject":
            COMMUNITY_POSTS.labels(outcome="rejected", reason=screening.reason or "rejected").inc()
            with self.db.session() as session:
                transparency.record(session, "rejected", screening.reason or "rejected", lang)
            raise CommunityError(422, screening.reason or "rejected")
        return screening

    @staticmethod
    def _count(row: CommunityPostRow, screening: Screening) -> None:
        COMMUNITY_POSTS.labels(outcome=row.status, reason=screening.reason or "none").inc()

    def _language(self, lang: str | None) -> str:
        code = (lang or "").split("-")[0].lower()
        return code if code in self.settings.supported_languages else self.settings.default_language

    def _detect(self, text: str, hint: str) -> str:
        return detect_language(text, list(self.settings.supported_languages), hint=self._language(hint))

    @staticmethod
    def _require_active(member: CommunityMemberRow) -> None:
        if member.status != "active":
            raise CommunityError(403, f"member_{member.status}")

    def _rate_check(self, member: CommunityMemberRow, *, replies: bool) -> None:
        limit = self.settings.community_replies_per_hour if replies else self.settings.community_posts_per_hour
        with self.db.session() as session:
            recent = session.scalar(select(func.count()).select_from(CommunityPostRow).where(
                CommunityPostRow.member_id == member.id,
                CommunityPostRow.parent_id.isnot(None) if replies else CommunityPostRow.parent_id.is_(None),
                CommunityPostRow.created_at >= _now() - timedelta(hours=1)))
        if recent >= limit:
            raise CommunityError(429, "slow_down")

    def _first_posts_rule(self, member: CommunityMemberRow, screening: Screening) -> Screening:
        n = self.settings.community_hold_first_posts
        if n <= 0 or screening.action != "publish":
            return screening
        with self.db.session() as session:
            published = session.scalar(select(func.count()).select_from(CommunityPostRow).where(
                CommunityPostRow.member_id == member.id, CommunityPostRow.status == "published"))
        if published < n:
            screening.action, screening.reason = "hold", "new_member"
        return screening

    @staticmethod
    def _visible(post: CommunityPostRow, member: CommunityMemberRow, thread: bool = False) -> bool:
        if post.status == "published":
            return True
        if post.status == "held":
            return post.member_id == member.id
        return thread and post.status == "deleted" and post.parent_id is None and post.reply_count > 0

    @staticmethod
    def _reaction_counts(session: Session, post_id: str) -> dict[str, int]:
        rows = session.execute(select(CommunityReactionRow.kind, func.count()).where(
            CommunityReactionRow.post_id == post_id).group_by(CommunityReactionRow.kind)).all()
        return {kind: int(n) for kind, n in rows}

    @staticmethod
    def _refresh_reply_count(session: Session, parent_id: str) -> None:
        parent = session.get(CommunityPostRow, parent_id)
        if parent is not None:
            parent.reply_count = int(session.scalar(select(func.count()).select_from(CommunityPostRow).where(
                CommunityPostRow.parent_id == parent_id, CommunityPostRow.status == "published")) or 0)

    def _activity(self, member: CommunityMemberRow) -> MemberActivity:
        since = _aware(member.last_seen_at) or _now()
        with self.db.session() as session:
            my_roots = select(CommunityPostRow.id).where(CommunityPostRow.member_id == member.id,
                                                         CommunityPostRow.parent_id.is_(None))
            my_posts = select(CommunityPostRow.id).where(CommunityPostRow.member_id == member.id)
            replies = session.scalars(select(CommunityPostRow).where(
                CommunityPostRow.parent_id.in_(my_roots), CommunityPostRow.status == "published",
                or_(CommunityPostRow.member_id.is_(None), CommunityPostRow.member_id != member.id))
                .order_by(CommunityPostRow.created_at.desc()).limit(50)).all()
            reactions = session.execute(select(CommunityReactionRow, CommunityPostRow).join(
                CommunityPostRow, CommunityPostRow.id == CommunityReactionRow.post_id).where(
                CommunityReactionRow.post_id.in_(my_posts), CommunityReactionRow.member_id != member.id)
                .order_by(CommunityReactionRow.created_at.desc()).limit(50)).all()
            hidden = self._hidden_authors(session, member.id)
            replies = [r for r in replies if r.member_id not in hidden]
            reactions = [(rx, p) for rx, p in reactions if rx.member_id not in hidden]
            handles = self._handles(session, {r.member_id for r in replies if r.member_id}
                                    | {rx.member_id for rx, _ in reactions})
        items = [ActivityItem(type="reply", post_id=r.id, root_id=r.parent_id or r.id,
                              by=handles.get(r.member_id or "", ""), excerpt=r.body[:140],
                              created_at=_aware(r.created_at)) for r in replies]
        items += [ActivityItem(type="reaction", post_id=p.id, root_id=p.parent_id or p.id,
                               by=handles.get(rx.member_id, ""), kind=rx.kind, created_at=_aware(rx.created_at))
                  for rx, p in reactions]
        items.sort(key=lambda i: i.created_at, reverse=True)
        return MemberActivity(
            new_replies=sum(1 for r in replies if _aware(r.created_at) > since),
            new_reactions=sum(1 for rx, _ in reactions if _aware(rx.created_at) > since),
            recent=items[:20],
        )

    @staticmethod
    def _handles(session: Session, ids: set[str]) -> dict[str, str]:
        if not ids:
            return {}
        return dict(session.execute(select(CommunityMemberRow.id, CommunityMemberRow.handle)
                                    .where(CommunityMemberRow.id.in_(ids))).all())

    def _posts(self, session: Session, rows: list[CommunityPostRow], viewer: CommunityMemberRow | None) -> list[Post]:
        authors = {}
        ids = {r.member_id for r in rows if r.member_id}
        if ids:
            authors = {m.id: m for m in session.scalars(select(CommunityMemberRow)
                                                         .where(CommunityMemberRow.id.in_(ids)))}
        mine: dict[str, list[str]] = {}
        if viewer is not None and rows:
            for post_id, kind in session.execute(select(CommunityReactionRow.post_id, CommunityReactionRow.kind).where(
                    CommunityReactionRow.member_id == viewer.id,
                    CommunityReactionRow.post_id.in_([r.id for r in rows]))):
                mine.setdefault(post_id, []).append(kind)
        related_ids = [r.related_insight_id for r in rows if r.related_insight_id]
        related: dict[str, RelatedInsight] = {}
        if related_ids:
            for ins in session.scalars(select(InsightRow).where(InsightRow.id.in_(set(related_ids)),
                                                                InsightRow.status == "published")):
                related[ins.id] = RelatedInsight(id=ins.id, title=ins.title, category=ins.category,
                                                 evidence_level=ins.evidence_level)
        out = []
        for r in rows:
            author = authors.get(r.member_id or "")
            out.append(Post(
                id=r.id, parent_id=r.parent_id, circle=r.circle, kind=r.kind, language=r.language,
                body=r.body if r.status != "deleted" else "", status=r.status,
                author=Author(handle=author.handle, journey=author.journey,
                              is_me=viewer is not None and author.id == viewer.id) if author else None,
                notes=list(r.notes or []), related_insight=related.get(r.related_insight_id or ""),
                reactions=dict(r.reaction_counts or {}), my_reactions=sorted(mine.get(r.id, [])),
                reply_count=r.reply_count, created_at=_aware(r.created_at), edited_at=_aware(r.edited_at),
            ))
        return out

    def _post(self, row: CommunityPostRow, member: CommunityMemberRow) -> Post:
        with self.db.session() as session:
            return self._posts(session, [row], member)[0]

    @staticmethod
    def _outcome(row: CommunityPostRow, screening: Screening) -> ModerationOutcome:
        return ModerationOutcome(status=row.status, reason=screening.reason, safety=screening.safety)

    @staticmethod
    def _member(row: CommunityMemberRow) -> Member:
        return Member(id=row.id, handle=row.handle, language=row.language, journey=row.journey, status=row.status,
                      created_at=_aware(row.created_at), guidelines_version=row.guidelines_version)
