"""
Cancer LLM Insights - Main FastAPI Application
A comprehensive platform for cancer prevention and lifestyle insights powered by AI.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - startup and shutdown tasks."""
    await init_db()
    yield


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.PROJECT_DESCRIPTION,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
    )

    # Security middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.ENVIRONMENT == "production":
        application.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS,
        )

    # Include API routes
    application.include_router(api_router, prefix=settings.API_V1_STR)

    return application


def custom_openapi(app: FastAPI):
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=settings.PROJECT_DESCRIPTION,
        routes=app.routes,
    )
    openapi_schema["info"]["x-logo"] = {
        "url": "https://cancer-insights.ai/logo.png"
    }
    openapi_schema["tags"] = [
        {"name": "auth", "description": "Authentication and user management"},
        {"name": "analysis", "description": "Cancer risk analysis via audio, video, or text"},
        {"name": "insights", "description": "Research-backed cancer insights and information"},
        {"name": "lifestyle", "description": "Personalized lifestyle and nutrition recommendations"},
        {"name": "users", "description": "User profile and subscription management"},
        {"name": "admin", "description": "Administrative endpoints"},
    ]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app = create_application()
app.openapi = lambda: custom_openapi(app)
