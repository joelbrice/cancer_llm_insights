"""Analysis SQLAlchemy model."""

import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Enum, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AnalysisType(str, enum.Enum):
    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    IMAGE = "image"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    UNKNOWN = "unknown"


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    analysis_type: Mapped[AnalysisType] = mapped_column(Enum(AnalysisType), nullable=False)
    input_language: Mapped[str] = mapped_column(String(10), default="en")
    response_language: Mapped[str] = mapped_column(String(10), default="en")

    # Input data
    input_text: Mapped[str] = mapped_column(Text, nullable=True)
    transcription: Mapped[str] = mapped_column(Text, nullable=True)  # For audio/video

    # AI output
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.UNKNOWN)
    risk_score: Mapped[float] = mapped_column(Float, nullable=True)
    insights: Mapped[str] = mapped_column(Text, nullable=True)
    lifestyle_recommendations: Mapped[str] = mapped_column(Text, nullable=True)
    nutrition_recommendations: Mapped[str] = mapped_column(Text, nullable=True)
    references: Mapped[dict] = mapped_column(JSON, nullable=True)

    # Metadata
    is_premium_result: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationship
    user = relationship("User", back_populates=None, foreign_keys=[user_id])
