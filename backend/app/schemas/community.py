"""Community API contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.safety.guardrails import SafetyAssessment
from app.schemas.api import Audience, RelatedInsight

PostKind = Literal["win", "encouragement", "question", "tip", "milestone"]
ReactionKind = Literal["support", "strength", "thanks", "inspired"]
ReportReason = Literal["harmful_medical", "crisis", "harassment", "spam", "privacy", "other"]
PostStatus = Literal["published", "held", "removed", "deleted"]


class CircleInfo(BaseModel):
    id: str
    icon: str
    audience: Audience
    title: str
    description: str
    prompt: str  # this week's encouragement prompt


class CommunityMeta(BaseModel):
    enabled: bool
    guidelines_version: int
    min_age: int
    circles: list[CircleInfo]
    kinds: list[str]
    reactions: list[str]
    report_reasons: list[str]
    limits: dict[str, int]


class MemberCreate(BaseModel):
    handle: str = Field(min_length=3, max_length=24)
    language: str = Field(default="en", max_length=8)
    journey: Audience | None = None
    accept_guidelines: bool
    confirm_age: bool
    consent_health_data: bool

    @field_validator("handle")
    @classmethod
    def strip(cls, v: str) -> str:
        return " ".join(v.split())


class MemberUpdate(BaseModel):
    handle: str | None = Field(default=None, min_length=3, max_length=24)
    language: str | None = Field(default=None, max_length=8)
    journey: Audience | None = None
    clear_journey: bool = False


class Member(BaseModel):
    id: str
    handle: str
    language: str
    journey: Audience | None
    status: str
    created_at: datetime
    guidelines_version: int


class MemberActivity(BaseModel):
    new_replies: int
    new_reactions: int
    recent: list[ActivityItem]


class ActivityItem(BaseModel):
    type: Literal["reply", "reaction"]
    post_id: str
    root_id: str
    by: str
    kind: str | None = None
    excerpt: str | None = None
    created_at: datetime


class MemberSession(BaseModel):
    member: Member
    token: str


class MemberMe(BaseModel):
    member: Member
    activity: MemberActivity


class Author(BaseModel):
    handle: str
    journey: Audience | None = None
    is_me: bool = False


class PostCreate(BaseModel):
    circle: str = Field(max_length=32)
    kind: PostKind
    body: str = Field(min_length=2, max_length=2000)
    language: str | None = Field(default=None, max_length=8)


class ReplyCreate(BaseModel):
    body: str = Field(min_length=2, max_length=1000)
    language: str | None = Field(default=None, max_length=8)


class PostUpdate(BaseModel):
    body: str = Field(min_length=2, max_length=2000)


class Post(BaseModel):
    id: str
    parent_id: str | None
    circle: str
    kind: str
    language: str
    body: str
    status: PostStatus
    author: Author | None  # None when the author deleted their account
    notes: list[str] = Field(default_factory=list)
    related_insight: RelatedInsight | None = None
    reactions: dict[str, int] = Field(default_factory=dict)
    my_reactions: list[str] = Field(default_factory=list)
    reply_count: int = 0
    created_at: datetime
    edited_at: datetime | None = None


class PostThread(BaseModel):
    post: Post
    replies: list[Post]


class PostPage(BaseModel):
    items: list[Post]
    next_cursor: str | None


class ModerationOutcome(BaseModel):
    """What the author is told after posting. `safety` carries crisis / urgent guidance when relevant."""

    status: PostStatus
    reason: str | None = None
    safety: SafetyAssessment | None = None


class PostResult(BaseModel):
    post: Post
    moderation: ModerationOutcome


class ReactionResult(BaseModel):
    reactions: dict[str, int]
    my_reactions: list[str]


class ReportCreate(BaseModel):
    reason: ReportReason
    note: str | None = Field(default=None, max_length=500)


class ModerationDecision(BaseModel):
    action: Literal["approve", "remove"]
    note: str | None = Field(default=None, max_length=500)


class MemberStatusUpdate(BaseModel):
    status: Literal["active", "suspended", "banned"]


class BlockedMember(BaseModel):
    id: str
    handle: str
    created_at: datetime


AppealStatus = Literal["open", "upheld", "overturned"]
SurveyAnswer = Literal["yes", "somewhat", "no"]


class AppealCreate(BaseModel):
    text: str = Field(min_length=10, max_length=1000)


class Appeal(BaseModel):
    id: str
    post_id: str
    text: str
    post_status: Literal["held", "removed"]
    status: AppealStatus
    response: str | None = None  # the community lead's answer, written for the author
    created_at: datetime
    decided_at: datetime | None = None


class AppealResult(BaseModel):
    appeal: Appeal
    safety: SafetyAssessment | None = None  # crisis / urgent guidance when the appeal text needs it


class ModeratedPost(BaseModel):
    """One of the member's own posts that is held or was removed, with the reason and any appeal."""

    post: Post
    reason: str | None  # screening rule or "reported"
    decision: Literal["approve", "remove"] | None = None
    decided_at: datetime | None = None
    can_appeal: bool
    appeal: Appeal | None = None


class AppealDecision(BaseModel):
    action: Literal["uphold", "overturn"]
    response: str | None = Field(default=None, max_length=1000)


class AppealQueueItem(BaseModel):
    appeal: Appeal
    post: Post
    member_id: str | None
    moderation: dict
    priority: int


class SurveyStatus(BaseModel):
    due: bool
    last_answered_at: datetime | None = None


class SurveyCreate(BaseModel):
    answer: SurveyAnswer


class QueueItem(BaseModel):
    post: Post
    member_id: str | None
    flags: list[str]
    moderation: dict
    reports: list[dict]
    appeal: Appeal | None = None


MemberActivity.model_rebuild()
