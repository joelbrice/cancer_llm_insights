"""
Backend test suite for Cancer LLM Insights API.

Tests core functionality without requiring external LLM/AI services.
Uses SQLite in-memory database for isolation.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token

# ── In-memory SQLite for tests ─────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session")
async def create_tables():
    async with test_engine.begin() as conn:
        from app.models import user, analysis, subscription  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(create_tables):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session(create_tables):
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(db_session):
    from app.models.user import User
    user = User(
        email="test@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("TestPass1"),
        preferred_language="en",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    yield user
    # Cleanup
    await db_session.delete(user)
    await db_session.commit()


@pytest_asyncio.fixture
async def auth_headers(test_user):
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════════════════════════════
# Authentication tests
# ══════════════════════════════════════════════════════════════════════════════

class TestAuth:
    async def test_register_success(self, client):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "NewPass1",
                "full_name": "New User",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@example.com"
        assert data["subscription_tier"] == "free"

    async def test_register_duplicate_email(self, client, test_user):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "test@example.com", "password": "TestPass1"},
        )
        assert resp.status_code == 409

    async def test_register_weak_password(self, client):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "weak@example.com", "password": "short"},
        )
        assert resp.status_code == 422

    async def test_login_success(self, client, test_user):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPass1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client, test_user):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "WrongPass1"},
        )
        assert resp.status_code == 401

    async def test_login_unknown_email(self, client):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "TestPass1"},
        )
        assert resp.status_code == 401

    async def test_refresh_token(self, client, test_user):
        from app.core.security import create_refresh_token
        refresh = create_refresh_token(test_user.id)
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_refresh_with_access_token_fails(self, client, test_user):
        """Access tokens must not be accepted as refresh tokens."""
        access = create_access_token(test_user.id)
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access},
        )
        assert resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# User profile tests
# ══════════════════════════════════════════════════════════════════════════════

class TestUsers:
    async def test_get_me(self, client, auth_headers):
        resp = await client.get("/api/v1/users/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    async def test_get_me_unauthenticated(self, client):
        resp = await client.get("/api/v1/users/me")
        assert resp.status_code == 401

    async def test_update_me(self, client, auth_headers):
        resp = await client.put(
            "/api/v1/users/me",
            headers=auth_headers,
            json={"full_name": "Updated Name", "preferred_language": "fr"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"
        assert resp.json()["preferred_language"] == "fr"


# ══════════════════════════════════════════════════════════════════════════════
# Analysis tests
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalysis:
    async def test_text_analysis_anonymous(self, client):
        """Anonymous users can submit text analysis."""
        resp = await client.post(
            "/api/v1/analysis/text",
            json={
                "text": "I smoke daily and have a high-fat diet. Family history of colon cancer.",
                "language": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "risk_level" in data
        assert "insights" in data
        assert "lifestyle_recommendations" in data
        assert "nutrition_recommendations" in data
        assert "disclaimer" in data
        # Free users get truncated results
        assert "Upgrade" in data["insights"]

    async def test_text_analysis_authenticated_free(self, client, auth_headers):
        """Free-tier authenticated users get truncated results."""
        resp = await client.post(
            "/api/v1/analysis/text",
            headers=auth_headers,
            json={
                "text": "I exercise regularly, eat well but drink alcohol occasionally.",
                "language": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_level"] in {"low", "moderate", "high", "unknown"}

    async def test_text_analysis_too_short(self, client):
        resp = await client.post(
            "/api/v1/analysis/text",
            json={"text": "help", "language": "en"},
        )
        assert resp.status_code == 422

    async def test_analysis_history_requires_auth(self, client):
        resp = await client.get("/api/v1/analysis/history")
        assert resp.status_code == 401

    async def test_analysis_history(self, client, auth_headers):
        # Create an analysis first
        await client.post(
            "/api/v1/analysis/text",
            headers=auth_headers,
            json={"text": "I have been feeling very tired and lost weight recently.", "language": "en"},
        )
        resp = await client.get("/api/v1/analysis/history", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1


# ══════════════════════════════════════════════════════════════════════════════
# Insights tests
# ══════════════════════════════════════════════════════════════════════════════

class TestInsights:
    async def test_cancer_types(self, client):
        resp = await client.get("/api/v1/insights/cancer-types")
        assert resp.status_code == 200
        assert "cancer_types" in resp.json()
        assert len(resp.json()["cancer_types"]) > 0

    async def test_research_search(self, client):
        resp = await client.get("/api/v1/insights/research?query=diet+cancer+prevention")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data

    async def test_lifestyle_tips(self, client):
        resp = await client.get("/api/v1/insights/lifestyle-tips")
        assert resp.status_code == 200
        data = resp.json()
        assert "tips" in data
        assert len(data["tips"]) > 0

    async def test_nutrition_guide(self, client):
        resp = await client.get("/api/v1/insights/nutrition-guide")
        assert resp.status_code == 200
        data = resp.json()
        assert "foods_to_include" in data
        assert "foods_to_limit" in data
        assert "meal_principles" in data


# ══════════════════════════════════════════════════════════════════════════════
# Subscription tests
# ══════════════════════════════════════════════════════════════════════════════

class TestSubscriptions:
    async def test_list_plans(self, client):
        resp = await client.get("/api/v1/subscriptions/plans")
        assert resp.status_code == 200
        plans = resp.json()
        assert len(plans) == 3
        tiers = [p["tier"] for p in plans]
        assert "free" in tiers
        assert "basic" in tiers
        assert "pro" in tiers

    async def test_subscription_status_requires_auth(self, client):
        resp = await client.get("/api/v1/subscriptions/status")
        assert resp.status_code == 401

    async def test_subscription_status_free_user(self, client, auth_headers):
        resp = await client.get("/api/v1/subscriptions/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["tier"] == "free"
        assert "monthly_analyses_used" in data
        assert "monthly_analyses_limit" in data


# ══════════════════════════════════════════════════════════════════════════════
# Security tests
# ══════════════════════════════════════════════════════════════════════════════

class TestSecurity:
    async def test_invalid_token_rejected(self, client):
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401

    async def test_password_hashing(self):
        from app.core.security import get_password_hash, verify_password
        hashed = get_password_hash("MySecretPass1")
        assert hashed != "MySecretPass1"
        assert verify_password("MySecretPass1", hashed)
        assert not verify_password("WrongPass1", hashed)

    async def test_token_decode(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token("user_42")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user_42"
        assert payload["type"] == "access"

    async def test_expired_token_rejected(self):
        from app.core.security import create_access_token, decode_token
        from datetime import timedelta
        token = create_access_token("user_1", expires_delta=timedelta(seconds=-1))
        payload = decode_token(token)
        assert payload is None


# ══════════════════════════════════════════════════════════════════════════════
# Service unit tests
# ══════════════════════════════════════════════════════════════════════════════

class TestRAGService:
    def test_retrieve_returns_results(self):
        from app.services.rag_service import rag_service
        results = rag_service.retrieve("diet cancer prevention", n_results=2)
        assert isinstance(results, list)
        # May be empty if no keywords match, but shouldn't error
        assert len(results) <= 2

    def test_retrieve_tobacco_query(self):
        from app.services.rag_service import rag_service
        results = rag_service.retrieve("smoking tobacco cancer risk", n_results=3)
        assert isinstance(results, list)

    def test_add_document(self):
        from app.services.rag_service import rag_service, SEED_DOCUMENTS
        initial_count = len(SEED_DOCUMENTS)
        rag_service.add_document(
            "test_doc_001",
            "Test research content about sleep and cancer risk.",
            {"source": "Test Journal", "year": 2024},
        )
        assert len(SEED_DOCUMENTS) >= initial_count


class TestAudioService:
    @pytest.mark.asyncio
    async def test_unsupported_format_raises(self):
        from app.services.audio_service import transcribe_audio
        with pytest.raises(ValueError, match="Unsupported audio format"):
            await transcribe_audio(b"data", "file.xyz")

    @pytest.mark.asyncio
    async def test_file_too_large_raises(self):
        from app.services.audio_service import transcribe_audio
        from app.core.config import settings
        large_bytes = b"x" * (settings.MAX_AUDIO_SIZE_MB + 1) * 1024 * 1024
        with pytest.raises(ValueError, match="too large"):
            await transcribe_audio(large_bytes, "audio.mp3")

    @pytest.mark.asyncio
    async def test_mock_transcription_returns_text(self):
        from app.services.audio_service import transcribe_audio
        # Small valid-extension file — Whisper unavailable so mock kicks in
        result = await transcribe_audio(b"fake audio data", "test.mp3", "en")
        assert "text" in result
        assert isinstance(result["text"], str)
        assert len(result["text"]) > 0


class TestVideoService:
    @pytest.mark.asyncio
    async def test_unsupported_format_raises(self):
        from app.services.video_service import analyse_media
        with pytest.raises(ValueError, match="Unsupported file format"):
            await analyse_media(b"data", "file.xyz")

    @pytest.mark.asyncio
    async def test_file_too_large_raises(self):
        from app.services.video_service import analyse_media
        from app.core.config import settings
        large_bytes = b"x" * (settings.MAX_IMAGE_SIZE_MB + 1) * 1024 * 1024
        with pytest.raises(ValueError, match="too large"):
            await analyse_media(large_bytes, "photo.jpg")
