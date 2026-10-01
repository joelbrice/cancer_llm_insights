"""Community API. Members-only (X-Member-Token), never cached or indexed, screened and moderated."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status

from app.api.deps import container_dep, rate_limit, require_admin, resolve_language
from app.community.service import CommunityError, CommunityService
from app.container import Container
from app.db.models import CommunityMemberRow
from app.schemas.community import (
    CommunityMeta,
    Member,
    MemberCreate,
    MemberMe,
    MemberSession,
    MemberStatusUpdate,
    MemberUpdate,
    ModerationDecision,
    Post,
    PostCreate,
    PostPage,
    PostResult,
    PostThread,
    PostUpdate,
    QueueItem,
    ReactionResult,
    ReplyCreate,
    ReportCreate,
)


def community_dep(container: Container = Depends(container_dep)) -> CommunityService:
    if not container.settings.community_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "community disabled")
    return container.community


def _raise(exc: CommunityError) -> None:
    raise HTTPException(exc.status, exc.code) from exc


def current_member(x_member_token: str | None = Header(default=None),
                   community: CommunityService = Depends(community_dep)) -> CommunityMemberRow:
    try:
        return community.authenticate(x_member_token)
    except CommunityError as exc:
        _raise(exc)
        raise  # unreachable


def _country(x_country: str | None) -> str | None:
    return x_country.strip().upper()[:2] if x_country else None


router = APIRouter(prefix="/community", tags=["community"],
                   dependencies=[Depends(rate_limit("api"))])  # privacy headers: app.main


@router.get("/meta", response_model=CommunityMeta)
def meta(lang: str | None = None, community: CommunityService = Depends(community_dep),
         container: Container = Depends(container_dep)) -> CommunityMeta:
    return community.meta(resolve_language(lang, container))


@router.post("/members", response_model=MemberSession, status_code=201)
def join(body: MemberCreate, community: CommunityService = Depends(community_dep)) -> MemberSession:
    try:
        return community.join(body)
    except CommunityError as exc:
        _raise(exc)
        raise


@router.get("/members/me", response_model=MemberMe)
def me(member: CommunityMemberRow = Depends(current_member),
       community: CommunityService = Depends(community_dep)) -> MemberMe:
    return community.me(member)


@router.post("/members/me/seen", status_code=204)
def seen(member: CommunityMemberRow = Depends(current_member),
         community: CommunityService = Depends(community_dep)) -> Response:
    community.mark_seen(member)
    return Response(status_code=204)


@router.patch("/members/me", response_model=Member)
def update_me(body: MemberUpdate, member: CommunityMemberRow = Depends(current_member),
              community: CommunityService = Depends(community_dep)) -> Member:
    try:
        return community.update_member(member, body)
    except CommunityError as exc:
        _raise(exc)
        raise


@router.get("/members/me/export")
def export_me(member: CommunityMemberRow = Depends(current_member),
              community: CommunityService = Depends(community_dep)) -> dict:
    return community.export(member)


@router.delete("/members/me", status_code=204)
def erase_me(member: CommunityMemberRow = Depends(current_member),
             community: CommunityService = Depends(community_dep)) -> Response:
    community.erase(member)
    return Response(status_code=204)


@router.get("/posts", response_model=PostPage)
def feed(circle: str | None = None, kind: str | None = None, lang: str | None = None,
         cursor: str | None = None, limit: int = Query(20, ge=1, le=50),
         member: CommunityMemberRow = Depends(current_member),
         community: CommunityService = Depends(community_dep)) -> PostPage:
    try:
        return community.feed(member, circle=circle, kind=kind, language=lang, cursor=cursor, limit=limit)
    except CommunityError as exc:
        _raise(exc)
        raise


@router.post("/posts", response_model=PostResult, status_code=201)
def create_post(body: PostCreate, x_country: str | None = Header(default=None),
                member: CommunityMemberRow = Depends(current_member),
                community: CommunityService = Depends(community_dep)) -> PostResult:
    try:
        return community.create_post(member, body, _country(x_country))
    except CommunityError as exc:
        _raise(exc)
        raise


@router.get("/posts/{post_id}", response_model=PostThread)
def thread(post_id: str, member: CommunityMemberRow = Depends(current_member),
           community: CommunityService = Depends(community_dep)) -> PostThread:
    try:
        return community.thread(member, post_id)
    except CommunityError as exc:
        _raise(exc)
        raise


@router.patch("/posts/{post_id}", response_model=PostResult)
def edit_post(post_id: str, body: PostUpdate, x_country: str | None = Header(default=None),
              member: CommunityMemberRow = Depends(current_member),
              community: CommunityService = Depends(community_dep)) -> PostResult:
    try:
        return community.edit(member, post_id, body.body, _country(x_country))
    except CommunityError as exc:
        _raise(exc)
        raise


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: str, member: CommunityMemberRow = Depends(current_member),
                community: CommunityService = Depends(community_dep)) -> Response:
    try:
        community.delete_post(member, post_id)
    except CommunityError as exc:
        _raise(exc)
    return Response(status_code=204)


@router.post("/posts/{post_id}/replies", response_model=PostResult, status_code=201)
def reply(post_id: str, body: ReplyCreate, x_country: str | None = Header(default=None),
          member: CommunityMemberRow = Depends(current_member),
          community: CommunityService = Depends(community_dep)) -> PostResult:
    try:
        return community.reply(member, post_id, body, _country(x_country))
    except CommunityError as exc:
        _raise(exc)
        raise


@router.put("/posts/{post_id}/reactions/{kind}", response_model=ReactionResult)
def add_reaction(post_id: str, kind: str, member: CommunityMemberRow = Depends(current_member),
                 community: CommunityService = Depends(community_dep)) -> ReactionResult:
    try:
        return community.react(member, post_id, kind, on=True)
    except CommunityError as exc:
        _raise(exc)
        raise


@router.delete("/posts/{post_id}/reactions/{kind}", response_model=ReactionResult)
def remove_reaction(post_id: str, kind: str, member: CommunityMemberRow = Depends(current_member),
                    community: CommunityService = Depends(community_dep)) -> ReactionResult:
    try:
        return community.react(member, post_id, kind, on=False)
    except CommunityError as exc:
        _raise(exc)
        raise


@router.post("/posts/{post_id}/reports", status_code=202)
def report(post_id: str, body: ReportCreate, member: CommunityMemberRow = Depends(current_member),
           community: CommunityService = Depends(community_dep)) -> dict:
    try:
        community.report(member, post_id, body)
    except CommunityError as exc:
        _raise(exc)
    return {"ok": True}


# ── moderation (admin key) ──────────────────────────────────────────────────────────────────────────────────
admin_router = APIRouter(prefix="/admin/community", tags=["admin"],
                         dependencies=[Depends(require_admin)])


@admin_router.get("/queue", response_model=list[QueueItem])
def queue(limit: int = Query(100, ge=1, le=500), community: CommunityService = Depends(community_dep)):
    return community.queue(limit)


@admin_router.post("/posts/{post_id}/moderate", response_model=Post)
def moderate(post_id: str, body: ModerationDecision, community: CommunityService = Depends(community_dep)) -> Post:
    try:
        return community.decide(post_id, body.action, body.note)
    except CommunityError as exc:
        _raise(exc)
        raise


@admin_router.post("/members/{member_id}/status", response_model=Member)
def member_status(member_id: str, body: MemberStatusUpdate,
                  community: CommunityService = Depends(community_dep)) -> Member:
    try:
        return community.set_member_status(member_id, body.status)
    except CommunityError as exc:
        _raise(exc)
        raise


@admin_router.get("/stats")
def stats(community: CommunityService = Depends(community_dep)) -> dict:
    return community.stats()
