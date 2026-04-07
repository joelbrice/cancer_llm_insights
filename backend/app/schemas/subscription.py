"""Pydantic schemas for subscription and payment operations."""

from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class SubscriptionPlan(BaseModel):
    tier: str
    name: str
    price_monthly_usd: float
    analyses_per_month: int
    features: list[str]


class CheckoutSessionRequest(BaseModel):
    tier: str  # "basic" | "pro"
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str


class SubscriptionStatusResponse(BaseModel):
    tier: str
    status: str
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False
    monthly_analyses_used: int
    monthly_analyses_limit: int


class WebhookEvent(BaseModel):
    id: str
    type: str
    data: dict
