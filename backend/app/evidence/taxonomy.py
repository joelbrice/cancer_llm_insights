"""Evidence taxonomy: study designs, source credibility tiers and evidence levels.

Weights follow the classic evidence pyramid (Oxford CEBM / GRADE starting points) adapted for a
lifestyle-and-cancer knowledge base that mixes research, guidelines, institutional pages and blogs.
They are exposed through the API (`GET /api/v1/meta`) so the UI can explain every grade.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class SourceType(StrEnum):
    UMBRELLA_REVIEW = "umbrella_review"
    META_ANALYSIS = "meta_analysis"
    SYSTEMATIC_REVIEW = "systematic_review"
    GUIDELINE = "guideline"
    RCT = "rct"
    COHORT = "cohort"
    CASE_CONTROL = "case_control"
    CROSS_SECTIONAL = "cross_sectional"
    NARRATIVE_REVIEW = "narrative_review"
    CASE_SERIES = "case_series"
    EXPERT_OPINION = "expert_opinion"
    INSTITUTIONAL_WEB = "institutional_web"
    PRECLINICAL = "preclinical"
    NEWS = "news"
    BLOG = "blog"
    UNKNOWN = "unknown"


class Credibility(StrEnum):
    AUTHORITATIVE = "authoritative"
    PEER_REVIEWED = "peer_reviewed"
    REPUTABLE = "reputable"
    GENERAL = "general"
    UNVERIFIED = "unverified"


class EvidenceLevel(StrEnum):
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    VERY_LOW = "very_low"
    INSUFFICIENT = "insufficient"


@dataclass(frozen=True, slots=True)
class DesignInfo:
    weight: float
    tier: int  # position in the pyramid (1 = top)
    human_evidence: bool
    label: str
    description: str


DESIGN: dict[SourceType, DesignInfo] = {
    SourceType.UMBRELLA_REVIEW: DesignInfo(1.0, 1, True, "Umbrella review",
        "Review of systematic reviews/meta-analyses; the broadest synthesis available."),
    SourceType.META_ANALYSIS: DesignInfo(1.0, 1, True, "Meta-analysis",
        "Statistical pooling of multiple studies following a systematic search."),
    SourceType.SYSTEMATIC_REVIEW: DesignInfo(0.95, 1, True, "Systematic review",
        "Structured, reproducible synthesis of all relevant studies on a question."),
    SourceType.GUIDELINE: DesignInfo(0.95, 1, True, "Guideline",
        "Recommendation from an expert body (e.g. WHO, IARC, NCI, WCRF) based on graded evidence."),
    SourceType.RCT: DesignInfo(0.85, 2, True, "Randomised controlled trial",
        "Participants randomly assigned to an intervention or control — strongest single-study design."),
    SourceType.COHORT: DesignInfo(0.65, 3, True, "Cohort study",
        "Follows people over time to relate exposures to later outcomes; observational."),
    SourceType.CASE_CONTROL: DesignInfo(0.55, 3, True, "Case-control study",
        "Compares past exposures of people with and without a disease; prone to recall bias."),
    SourceType.CROSS_SECTIONAL: DesignInfo(0.40, 4, True, "Cross-sectional study",
        "Snapshot at one point in time; cannot establish cause and effect."),
    SourceType.NARRATIVE_REVIEW: DesignInfo(0.45, 4, True, "Narrative review",
        "Expert summary of the literature without a systematic method."),
    SourceType.CASE_SERIES: DesignInfo(0.25, 5, True, "Case series / report",
        "Descriptions of individual patients; hypothesis-generating only."),
    SourceType.INSTITUTIONAL_WEB: DesignInfo(0.60, 4, True, "Institutional information",
        "Patient information from cancer institutes, hospitals or health agencies."),
    SourceType.EXPERT_OPINION: DesignInfo(0.30, 5, True, "Expert opinion",
        "Editorials, commentaries and opinions of experts."),
    SourceType.PRECLINICAL: DesignInfo(0.15, 6, False, "Pre-clinical (lab/animal)",
        "Cell or animal studies; results often do not translate to humans."),
    SourceType.NEWS: DesignInfo(0.20, 6, False, "News article",
        "Journalistic coverage; secondary and may oversimplify findings."),
    SourceType.BLOG: DesignInfo(0.15, 6, False, "Blog",
        "Expert or personal blog; never sufficient on its own for a recommendation."),
    SourceType.UNKNOWN: DesignInfo(0.20, 6, False, "Unclassified",
        "Study design could not be determined."),
}

CREDIBILITY: dict[Credibility, tuple[float, str, str]] = {
    Credibility.AUTHORITATIVE: (1.00, "Authoritative body",
        "International/national health agency or specialist society (WHO, IARC, NCI, ESMO…)."),
    Credibility.PEER_REVIEWED: (0.95, "Peer-reviewed",
        "Published in a peer-reviewed scientific journal."),
    Credibility.REPUTABLE: (0.85, "Reputable institution",
        "Cancer centre, university hospital or established patient organisation."),
    Credibility.GENERAL: (0.60, "General",
        "General publisher or author without formal review."),
    Credibility.UNVERIFIED: (0.40, "Unverified",
        "Origin or review process unknown."),
}


@dataclass(frozen=True, slots=True)
class LevelInfo:
    min_score: float
    grade: str
    label: str
    description: str


LEVELS: dict[EvidenceLevel, LevelInfo] = {
    EvidenceLevel.HIGH: LevelInfo(0.75, "A", "High",
        "Consistent findings from high-quality syntheses or guidelines. Further research is unlikely to change the conclusion."),
    EvidenceLevel.MODERATE: LevelInfo(0.55, "B", "Moderate",
        "Good evidence, but more research could change the size of the effect."),
    EvidenceLevel.LOW: LevelInfo(0.35, "C", "Low",
        "Limited or observational evidence; the true effect may differ substantially."),
    EvidenceLevel.VERY_LOW: LevelInfo(0.0, "D", "Very low",
        "Very uncertain: few, weak or indirect sources. Treat as a hypothesis."),
    EvidenceLevel.INSUFFICIENT: LevelInfo(-1.0, "–", "Insufficient",
        "The library does not contain enough evidence to support a statement."),
}

LEVEL_ORDER = [EvidenceLevel.HIGH, EvidenceLevel.MODERATE, EvidenceLevel.LOW, EvidenceLevel.VERY_LOW,
               EvidenceLevel.INSUFFICIENT]


def level_for_score(score: float) -> EvidenceLevel:
    for level in LEVEL_ORDER[:-1]:
        if score >= LEVELS[level].min_score:
            return level
    return EvidenceLevel.VERY_LOW


def level_rank(level: EvidenceLevel | str) -> int:
    return LEVEL_ORDER.index(EvidenceLevel(level))


def coerce_source_type(value: str | None) -> SourceType | None:
    if not value:
        return None
    key = value.strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "randomized_controlled_trial": "rct", "randomised_controlled_trial": "rct", "clinical_trial": "rct",
        "trial": "rct", "meta": "meta_analysis", "metaanalysis": "meta_analysis", "review": "narrative_review",
        "sr": "systematic_review", "cohort_study": "cohort", "case_report": "case_series",
        "guidelines": "guideline", "practice_guideline": "guideline", "web": "institutional_web",
        "website": "institutional_web", "editorial": "expert_opinion", "opinion": "expert_opinion",
        "comment": "expert_opinion", "animal": "preclinical", "in_vitro": "preclinical",
        "observational": "cohort", "case_control_study": "case_control",
    }
    key = aliases.get(key, key)
    try:
        return SourceType(key)
    except ValueError:
        return None


def coerce_credibility(value: str | None) -> Credibility | None:
    if not value:
        return None
    try:
        return Credibility(value.strip().lower().replace("-", "_").replace(" ", "_"))
    except ValueError:
        return None


CATEGORIES: dict[str, str] = {
    "tobacco": "Tobacco & nicotine",
    "alcohol": "Alcohol",
    "nutrition": "Nutrition & diet",
    "body_weight": "Body weight",
    "physical_activity": "Physical activity",
    "sun_uv": "Sun & UV",
    "infections_vaccination": "Infections & vaccination",
    "screening": "Screening & early detection",
    "reproductive_health": "Hormones & reproductive health",
    "environment": "Environment & occupation",
    "sleep_stress": "Sleep, stress & wellbeing",
    "treatment_side_effects": "Managing treatment side effects",
    "survivorship": "Survivorship & recurrence",
    "mental_health": "Emotional health",
    "complementary": "Complementary approaches",
    "caregivers": "Caregivers",
}

AUDIENCES: dict[str, str] = {
    "prevention": "Lower my risk",
    "in_treatment": "Going through treatment",
    "after_treatment": "Recovering & life after cancer",
    "caregivers": "Supporting someone",
}
