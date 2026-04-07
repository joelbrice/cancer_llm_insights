"""
Application configuration using Pydantic Settings.
All sensitive settings are loaded from environment variables.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator


class Settings(BaseSettings):
    # ── Project ────────────────────────────────────────────────────────────────
    PROJECT_NAME: str = "Cancer LLM Insights"
    PROJECT_DESCRIPTION: str = (
        "AI-powered platform for cancer prevention, lifestyle guidance, and research-backed insights. "
        "Supports audio/video analysis, multi-language responses, and personalised nutrition advice."
    )
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # ── API ────────────────────────────────────────────────────────────────────
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_USE_OPENSSL_RAND_HEX_32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # ── CORS & Hosts ───────────────────────────────────────────────────────────
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "https://cancer-insights.ai",
    ]
    ALLOWED_HOSTS: List[str] = ["cancer-insights.ai", "*.cancer-insights.ai"]

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./cancer_insights.db"

    # ── Redis (rate limiting & caching) ───────────────────────────────────────
    REDIS_URL: Optional[str] = None

    # ── LLM Configuration ─────────────────────────────────────────────────────
    # Primary LLM provider: "openai", "groq", "ollama"
    LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama3-70b-8192"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # ── Embeddings ────────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    CHROMA_PERSIST_DIR: str = "./data/chroma_db"

    # ── Audio (Whisper) ───────────────────────────────────────────────────────
    WHISPER_MODEL: str = "base"          # tiny | base | small | medium | large
    MAX_AUDIO_SIZE_MB: int = 25

    # ── Video / Facial ────────────────────────────────────────────────────────
    MAX_VIDEO_SIZE_MB: int = 100
    MAX_IMAGE_SIZE_MB: int = 10

    # ── Subscription tiers ────────────────────────────────────────────────────
    FREE_ANALYSES_PER_MONTH: int = 3
    FREE_MAX_RESPONSE_LENGTH: int = 500   # characters

    # ── Payment (Stripe) ──────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_BASIC_PRICE_ID: Optional[str] = None
    STRIPE_PRO_PRICE_ID: Optional[str] = None

    # ── Email ─────────────────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: str = "noreply@cancer-insights.ai"
    EMAILS_FROM_NAME: str = "Cancer LLM Insights"

    # ── Supported Languages ───────────────────────────────────────────────────
    SUPPORTED_LANGUAGES: List[str] = [
        "en", "fr", "es", "de", "pt", "zh", "ar", "hi", "sw", "yo"
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
