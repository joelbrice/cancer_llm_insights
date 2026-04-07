"""
Subscription and payment endpoints (Stripe integration).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.api.v1.deps import require_auth
from app.models.user import User, SubscriptionTier
from app.models.subscription import Subscription, SubscriptionStatus
from app.schemas.subscription import (
    SubscriptionPlan,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    SubscriptionStatusResponse,
)

router = APIRouter()

PLANS: list[SubscriptionPlan] = [
    SubscriptionPlan(
        tier="free",
        name="Free",
        price_monthly_usd=0.0,
        analyses_per_month=settings.FREE_ANALYSES_PER_MONTH,
        features=[
            f"{settings.FREE_ANALYSES_PER_MONTH} analyses per month",
            "Text analysis",
            "Truncated results",
            "Basic lifestyle tips",
        ],
    ),
    SubscriptionPlan(
        tier="basic",
        name="Basic",
        price_monthly_usd=9.99,
        analyses_per_month=50,
        features=[
            "50 analyses per month",
            "Text + Audio analysis",
            "Full results with references",
            "Personalised nutrition guide",
            "Multi-language support",
            "Priority support",
        ],
    ),
    SubscriptionPlan(
        tier="pro",
        name="Pro",
        price_monthly_usd=24.99,
        analyses_per_month=-1,  # Unlimited
        features=[
            "Unlimited analyses",
            "Text + Audio + Video/Image analysis",
            "Full results with research references",
            "Personalised nutrition & lifestyle plans",
            "API access for developers",
            "Multi-language support (10+ languages)",
            "Priority support",
            "Early access to new features",
        ],
    ),
]


@router.get(
    "/plans",
    response_model=list[SubscriptionPlan],
    summary="List available subscription plans",
    tags=["subscriptions"],
)
async def list_plans():
    """Returns all available subscription plans and their features."""
    return PLANS


@router.get(
    "/status",
    response_model=SubscriptionStatusResponse,
    summary="Get current subscription status",
    tags=["subscriptions"],
)
async def get_subscription_status(current_user: User = Depends(require_auth)):
    tier = current_user.subscription_tier.value
    limit = settings.FREE_ANALYSES_PER_MONTH if tier == "free" else (
        50 if tier == "basic" else -1
    )
    return SubscriptionStatusResponse(
        tier=tier,
        status="active",
        monthly_analyses_used=current_user.monthly_analyses_used,
        monthly_analyses_limit=limit,
    )


@router.post(
    "/checkout",
    response_model=CheckoutSessionResponse,
    summary="Create a Stripe checkout session to upgrade subscription",
    tags=["subscriptions"],
)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a Stripe Checkout session. The client should redirect the user
    to the returned `checkout_url`.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not configured on this server.",
        )

    price_id = (
        settings.STRIPE_BASIC_PRICE_ID
        if body.tier == "basic"
        else settings.STRIPE_PRO_PRICE_ID
    )
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No Stripe price configured for tier '{body.tier}'.",
        )

    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            customer_email=current_user.email,
            metadata={"user_id": str(current_user.id), "tier": body.tier},
        )
        return CheckoutSessionResponse(
            checkout_url=session.url,
            session_id=session.id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment session creation failed: {exc}",
        )


@router.post(
    "/webhook",
    include_in_schema=False,
    summary="Stripe webhook receiver",
)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receives and processes Stripe webhook events.
    Handles: checkout.session.completed, customer.subscription.updated/deleted.
    """
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe not configured.")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook error: {exc}")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = int(data.get("metadata", {}).get("user_id", 0))
        tier = data.get("metadata", {}).get("tier", "basic")
        stripe_sub_id = data.get("subscription")
        stripe_customer_id = data.get("customer")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.subscription_tier = SubscriptionTier(tier)
            user.stripe_customer_id = stripe_customer_id
            user.stripe_subscription_id = stripe_sub_id
            await db.commit()

    elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
        stripe_sub_id = data.get("id")
        sub_status = data.get("status")

        result = await db.execute(
            select(User).where(User.stripe_subscription_id == stripe_sub_id)
        )
        user = result.scalar_one_or_none()
        if user:
            if sub_status in ("canceled", "cancelled", "unpaid"):
                user.subscription_tier = SubscriptionTier.FREE
                user.stripe_subscription_id = None
                await db.commit()

    return {"received": True}
