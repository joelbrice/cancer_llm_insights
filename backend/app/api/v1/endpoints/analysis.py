"""
Analysis endpoints: text, audio, video/image, and history.

Free tier: 3 analyses/month, truncated results.
Paid tiers: unlimited analyses, full results.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_user, require_auth
from app.models.user import User, SubscriptionTier
from app.models.analysis import Analysis, AnalysisType, RiskLevel
from app.schemas.analysis import (
    TextAnalysisRequest,
    AnalysisResponse,
    AnalysisListResponse,
)
from app.services import llm_service, rag_service as rag_module, audio_service, video_service

logger = logging.getLogger(__name__)
router = APIRouter()


async def _check_and_increment_usage(user: User | None, db: AsyncSession) -> bool:
    """
    Returns True if the user is allowed to perform another analysis.
    For free-tier users, enforces the monthly limit.
    Always allows anonymous access (returns True, result will be truncated).
    """
    if user is None:
        return True  # Anonymous — allowed, but result will be minimal

    if user.subscription_tier != SubscriptionTier.FREE:
        return True  # Paid plan — no limit

    # Reset monthly counter if new month
    now = datetime.now(timezone.utc)
    reset = user.usage_reset_date
    if reset.tzinfo is None:
        reset = reset.replace(tzinfo=timezone.utc)
    if now.year > reset.year or now.month > reset.month:
        user.monthly_analyses_used = 0
        user.usage_reset_date = now
        await db.commit()

    if user.monthly_analyses_used >= settings.FREE_ANALYSES_PER_MONTH:
        return False

    user.monthly_analyses_used += 1
    await db.commit()
    return True


def _truncate_response(response: AnalysisResponse, max_len: int) -> AnalysisResponse:
    suffix = "… [Upgrade to a paid plan to see the full analysis]"
    response.insights = response.insights[:max_len] + suffix
    response.lifestyle_recommendations = response.lifestyle_recommendations[:max_len] + suffix
    response.nutrition_recommendations = response.nutrition_recommendations[:max_len] + suffix
    response.references = None
    return response


async def _run_and_save(
    input_text: str,
    analysis_type: AnalysisType,
    language: str,
    response_language: str,
    cancer_type: Optional[str],
    user: User | None,
    db: AsyncSession,
    transcription: Optional[str] = None,
    media_summary: Optional[str] = None,
) -> AnalysisResponse:
    """Core analysis pipeline shared by all analysis endpoints."""

    # Enrich input with media summary
    combined_input = input_text
    if media_summary:
        combined_input = f"{input_text}\n\nVisual indicators from media: {media_summary}"

    # Retrieve RAG context
    context_docs = rag_module.rag_service.retrieve(combined_input, n_results=3)

    # Run LLM analysis
    result = await llm_service.run_analysis(
        user_input=combined_input,
        cancer_type=cancer_type,
        language=response_language,
        context_docs=context_docs,
    )

    is_premium = user is not None and user.subscription_tier != SubscriptionTier.FREE

    analysis = Analysis(
        user_id=user.id if user else None,
        analysis_type=analysis_type,
        input_language=language,
        response_language=response_language,
        input_text=input_text,
        transcription=transcription,
        risk_level=RiskLevel(result.get("risk_level", "unknown")),
        risk_score=result.get("risk_score"),
        insights=result.get("insights", ""),
        lifestyle_recommendations=result.get("lifestyle_recommendations", ""),
        nutrition_recommendations=result.get("nutrition_recommendations", ""),
        references=result.get("references"),
        is_premium_result=is_premium,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    resp = AnalysisResponse.model_validate(analysis)
    if hasattr(resp, "created_at") and hasattr(analysis.created_at, "isoformat"):
        resp.created_at = analysis.created_at.isoformat()

    # Truncate for free/anonymous users
    if not is_premium:
        resp = _truncate_response(resp, settings.FREE_MAX_RESPONSE_LENGTH)

    return resp


@router.post(
    "/text",
    response_model=AnalysisResponse,
    summary="Analyse text description for cancer risk insights",
    tags=["analysis"],
)
async def analyse_text(
    body: TextAnalysisRequest,
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a text description of symptoms, lifestyle, or concerns and
    receive AI-powered cancer risk insights backed by research literature.

    **Free tier**: 3 analyses/month with truncated results.
    **Paid tiers**: Unlimited analyses with full results and references.
    """
    allowed = await _check_and_increment_usage(current_user, db)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You have used all {settings.FREE_ANALYSES_PER_MONTH} free analyses "
                "for this month. Please upgrade to continue."
            ),
        )

    resp_lang = body.response_language or body.language
    return await _run_and_save(
        input_text=body.text,
        analysis_type=AnalysisType.TEXT,
        language=body.language,
        response_language=resp_lang,
        cancer_type=body.cancer_type,
        user=current_user,
        db=db,
    )


@router.post(
    "/audio",
    response_model=AnalysisResponse,
    summary="Analyse audio recording for cancer risk insights",
    tags=["analysis"],
)
async def analyse_audio(
    file: UploadFile = File(..., description="Audio file (mp3, wav, m4a, ogg, flac, webm)"),
    language: str = Form("en"),
    response_language: Optional[str] = Form(None),
    cancer_type: Optional[str] = Form(None),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an audio recording describing your symptoms or health concerns.
    The audio is transcribed using Whisper, then analysed by the LLM.
    """
    allowed = await _check_and_increment_usage(current_user, db)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Free tier monthly limit reached "
                f"({settings.FREE_ANALYSES_PER_MONTH} analyses/month). "
                "Please upgrade to continue."
            ),
        )

    audio_bytes = await file.read()
    try:
        transcription_result = await audio_service.transcribe_audio(
            audio_bytes, file.filename or "audio.mp3", language
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    transcribed_text = transcription_result["text"]
    detected_lang = transcription_result.get("language", language)
    resp_lang = response_language or detected_lang

    return await _run_and_save(
        input_text=transcribed_text,
        analysis_type=AnalysisType.AUDIO,
        language=detected_lang,
        response_language=resp_lang,
        cancer_type=cancer_type,
        user=current_user,
        db=db,
        transcription=transcribed_text,
    )


@router.post(
    "/video",
    response_model=AnalysisResponse,
    summary="Analyse video or image for visual health indicators and cancer risk",
    tags=["analysis"],
)
async def analyse_video(
    file: UploadFile = File(..., description="Video or image file"),
    language: str = Form("en"),
    response_language: Optional[str] = Form(None),
    cancer_type: Optional[str] = Form(None),
    include_facial_analysis: bool = Form(True),
    description: str = Form("", description="Optional text description to accompany the media"),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a video or image. The service analyses visible health indicators
    (skin colour, facial attributes) and combines this with the LLM analysis.

    **Note**: Visual analysis is a heuristic screening tool only. A medical
    professional must be consulted for any diagnosis.
    """
    allowed = await _check_and_increment_usage(current_user, db)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Free tier monthly limit reached. Please upgrade to continue.",
        )

    media_bytes = await file.read()
    try:
        media_result = await video_service.analyse_media(
            media_bytes, file.filename or "media.jpg", include_facial_analysis
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    input_text = description or "Please analyse my visual health indicators."
    resp_lang = response_language or language

    return await _run_and_save(
        input_text=input_text,
        analysis_type=AnalysisType.VIDEO,
        language=language,
        response_language=resp_lang,
        cancer_type=cancer_type,
        user=current_user,
        db=db,
        media_summary=media_result.get("summary", ""),
    )


@router.get(
    "/history",
    response_model=AnalysisListResponse,
    summary="Get analysis history for the authenticated user",
    tags=["analysis"],
)
async def get_analysis_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated analysis history for the current user."""
    offset = (page - 1) * per_page

    count_result = await db.execute(
        select(func.count(Analysis.id)).where(Analysis.user_id == current_user.id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    analyses = result.scalars().all()

    items = []
    for a in analyses:
        resp = AnalysisResponse.model_validate(a)
        if hasattr(resp, "created_at") and hasattr(a.created_at, "isoformat"):
            resp.created_at = a.created_at.isoformat()
        items.append(resp)

    return AnalysisListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get(
    "/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Get a specific analysis by ID",
    tags=["analysis"],
)
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )
    resp = AnalysisResponse.model_validate(analysis)
    if hasattr(resp, "created_at") and hasattr(analysis.created_at, "isoformat"):
        resp.created_at = analysis.created_at.isoformat()
    return resp
