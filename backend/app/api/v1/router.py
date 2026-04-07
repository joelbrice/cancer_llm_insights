"""V1 API router — aggregates all endpoint routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, analysis, insights, users, subscriptions

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
