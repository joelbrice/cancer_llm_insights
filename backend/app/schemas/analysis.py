"""Pydantic schemas for analysis requests and responses."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TextAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=5000,
                      description="Describe your symptoms, lifestyle, or health concerns")
    language: str = Field("en", description="Language code (e.g. 'en', 'fr', 'es')")
    response_language: Optional[str] = Field(None,
                                             description="Language for the response; defaults to input language")
    cancer_type: Optional[str] = Field(None,
                                       description="Specific cancer type to focus on (optional)")


class AudioAnalysisRequest(BaseModel):
    language: str = Field("en", description="Language of the audio content")
    response_language: Optional[str] = None
    cancer_type: Optional[str] = None


class VideoAnalysisRequest(BaseModel):
    language: str = Field("en", description="Language spoken in the video")
    response_language: Optional[str] = None
    include_facial_analysis: bool = Field(True,
                                          description="Whether to run facial skin analysis")


class ResearchReference(BaseModel):
    title: str
    source: str
    year: Optional[int] = None
    url: Optional[str] = None


class AnalysisResponse(BaseModel):
    id: int
    analysis_type: str
    risk_level: str
    risk_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    insights: str
    lifestyle_recommendations: str
    nutrition_recommendations: str
    references: Optional[List[ResearchReference]] = None
    disclaimer: str = (
        "This analysis is for informational purposes only and does not constitute "
        "medical advice. Always consult a qualified healthcare professional."
    )
    is_premium_result: bool
    created_at: str

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_truncated(cls, analysis, max_length: int):
        """Return truncated response for free-tier users."""
        obj = cls.from_orm(analysis)
        obj.insights = obj.insights[:max_length] + "… [Upgrade to see full insights]"
        obj.lifestyle_recommendations = (
            obj.lifestyle_recommendations[:max_length]
            + "… [Upgrade to see full recommendations]"
        )
        obj.nutrition_recommendations = (
            obj.nutrition_recommendations[:max_length]
            + "… [Upgrade to see full recommendations]"
        )
        obj.references = None
        return obj


class AnalysisListResponse(BaseModel):
    items: List[AnalysisResponse]
    total: int
    page: int
    per_page: int
