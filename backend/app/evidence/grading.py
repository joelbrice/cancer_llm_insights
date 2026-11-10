"""Evidence grading (GRADE-inspired, fully transparent).

1. Per-source quality  q = design_weight × credibility_multiplier × recency_factor
2. Per-source contribution  e = q × (0.55 + 0.45 × support)   (support = how well the source backs the claim)
3. Aggregate  score = 0.65 × max(e) + 0.35 × (1 − Π(1 − 0.6·e))     (best source + diminishing breadth bonus)
4. Penalties  single source ×0.85 · mixed findings ×0.85
5. Caps & floors (GRADE logic): no human studies → ≤ Low; only blogs/news → ≤ Very low;
   no systematic review / trial / guideline → ≤ Moderate; ≥2 concordant top-tier syntheses → ≥ Moderate
6. Level: High ≥ 0.75 · Moderate ≥ 0.55 · Low ≥ 0.35 · Very low otherwise · Insufficient if no source.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from app.evidence.taxonomy import (
    CREDIBILITY,
    DESIGN,
    LEVELS,
    Credibility,
    EvidenceLevel,
    SourceType,
    coerce_credibility,
    coerce_source_type,
    level_for_score,
)
from app.i18n import design_label, level_label, t
from app.schemas.evidence import EvidenceAssessment, RationaleItem, SourceRef

SECONDARY = {SourceType.BLOG, SourceType.NEWS, SourceType.UNKNOWN}
TOP_TIER = {SourceType.UMBRELLA_REVIEW, SourceType.META_ANALYSIS, SourceType.SYSTEMATIC_REVIEW, SourceType.GUIDELINE}
STRONG_DESIGNS = TOP_TIER | {SourceType.RCT}
OBSERVATIONAL = {SourceType.COHORT, SourceType.CASE_CONTROL, SourceType.CROSS_SECTIONAL, SourceType.CASE_SERIES}


def recency_factor(year: int | None, source_type: SourceType, today: int | None = None) -> float:
    if year is None:
        return 0.85
    age = max(0, (today or date.today().year) - year)
    half_life = 8.0 if source_type == SourceType.GUIDELINE else 15.0  # guidelines get superseded faster
    return round(0.55 + 0.45 * 0.5 ** (age / half_life), 4)


def document_quality(source_type: str | None, credibility: str | None, year: int | None) -> float:
    stype = coerce_source_type(source_type) or SourceType.UNKNOWN
    cred = coerce_credibility(credibility) or Credibility.UNVERIFIED
    return round(DESIGN[stype].weight * CREDIBILITY[cred][0] * recency_factor(year, stype), 4)


def source_ref(payload: dict[str, Any]) -> SourceRef:
    stype = coerce_source_type(payload.get("source_type")) or SourceType.UNKNOWN
    cred = coerce_credibility(payload.get("credibility")) or Credibility.UNVERIFIED
    return SourceRef(
        document_id=payload.get("document_id", ""),
        title=payload.get("title") or "Untitled",
        authors=list(payload.get("authors") or [])[:12],
        year=payload.get("year"),
        journal=payload.get("journal"),
        publisher=payload.get("publisher"),
        doi=payload.get("doi"),
        pmid=payload.get("pmid"),
        url=payload.get("url"),
        source_type=stype.value,
        source_type_label=DESIGN[stype].label,
        credibility=cred.value,
        credibility_label=CREDIBILITY[cred][1],
        quality_score=float(payload.get("quality_score") or document_quality(stype, cred, payload.get("year"))),
        language=payload.get("language") or "en",
        license=payload.get("license"),
    )


@dataclass(slots=True)
class GradedSource:
    source: SourceRef
    support: float | None = None


class EvidenceGrader:
    def assess(
        self,
        sources: list[GradedSource],
        language: str = "en",
        consistency: str = "not_assessed",
        partial_support: bool = False,
    ) -> EvidenceAssessment:
        lang = language
        by_doc: dict[str, GradedSource] = {}
        for item in sources:  # one vote per document, keep its best support
            key = item.source.document_id or item.source.title
            prev = by_doc.get(key)
            if prev is None or (item.support or 0) > (prev.support or 0):
                by_doc[key] = item
        unique = list(by_doc.values())
        if not unique:
            info = LEVELS[EvidenceLevel.INSUFFICIENT]
            return EvidenceAssessment(
                level="insufficient", grade=info.grade, label=level_label("insufficient", lang), score=0.0,
                description=info.description, rationale=[RationaleItem(code="none", text=t("r_none", lang))],
            )

        contributions = []
        for item in unique:
            q = item.source.quality_score or document_quality(item.source.source_type, item.source.credibility,
                                                              item.source.year)
            s = 0.8 if item.support is None else max(0.0, min(1.0, item.support))
            contributions.append((q * (0.55 + 0.45 * s), item))
        contributions.sort(key=lambda c: -c[0])
        top = contributions[0][0]
        miss = 1.0
        for e, _ in contributions:
            miss *= 1 - 0.6 * e
        score = 0.65 * top + 0.35 * (1 - miss)

        designs = [coerce_source_type(i.source.source_type) or SourceType.UNKNOWN for i in unique]
        creds = [i.source.credibility for i in unique]
        caps: list[str] = []
        if len(unique) == 1:
            score *= 0.85
        if consistency == "mixed":
            score *= 0.85
        if all(d in SECONDARY for d in designs):
            score, caps = min(score, 0.34), [*caps, "secondary_only"]
        elif not any(DESIGN[d].human_evidence for d in designs):
            score, caps = min(score, 0.54), [*caps, "no_human"]
        elif not any(d in STRONG_DESIGNS for d in designs):
            score, caps = min(score, 0.74), [*caps, "observational"]
        concordant_top = [i for i in unique
                          if (coerce_source_type(i.source.source_type) in TOP_TIER) and (i.support or 0.8) >= 0.5]
        if len(concordant_top) >= 2 and consistency != "mixed":
            score = max(score, 0.55)
        score = round(max(0.0, min(1.0, score)), 3)
        level = level_for_score(score)
        info = LEVELS[level]

        design_counts: dict[str, int] = {}
        for d in designs:
            design_counts[d.value] = design_counts.get(d.value, 0) + 1
        cred_counts: dict[str, int] = {}
        for c in creds:
            cred_counts[c] = cred_counts.get(c, 0) + 1
        years = sorted(y for y in (i.source.year for i in unique) if y)
        strongest = contributions[0][1].source

        rationale = [RationaleItem(code="sources", text=t("r_sources", lang, n=len(unique)), params={"n": len(unique)})]
        ordered = sorted(design_counts, key=lambda d: DESIGN[SourceType(d)].tier)
        designs_text = ", ".join(f"{design_counts[d]}× {design_label(d, lang)}" for d in ordered)
        rationale.append(RationaleItem(code="designs", text=t("r_designs", lang, designs=designs_text),
                                       params={"designs": design_counts}))
        year_txt = f" ({strongest.year})" if strongest.year else ""
        rationale.append(RationaleItem(code="strongest", text=t("r_strongest", lang,
                                       design=design_label(strongest.source_type, lang), year=year_txt)))
        if Credibility.AUTHORITATIVE.value in cred_counts:
            rationale.append(RationaleItem(code="authoritative", text=t("r_authoritative", lang)))
        if years:
            if years[-1] < date.today().year - 10:
                rationale.append(RationaleItem(code="old", text=t("r_old", lang, year=years[-1]),
                                               params={"year": years[-1]}))
            else:
                rationale.append(RationaleItem(code="years", text=t("r_recent", lang, start=years[0], end=years[-1]),
                                               params={"start": years[0], "end": years[-1]}))
        if len(unique) == 1:
            rationale.append(RationaleItem(code="single_source", text=t("r_single_source", lang)))
        if all(d in OBSERVATIONAL for d in designs if d not in SECONDARY) and any(d in OBSERVATIONAL for d in designs):
            rationale.append(RationaleItem(code="observational", text=t("r_observational", lang)))
        if consistency == "consistent" and len(unique) > 1:
            rationale.append(RationaleItem(code="consistent", text=t("r_consistent", lang)))
        elif consistency == "mixed":
            rationale.append(RationaleItem(code="mixed", text=t("r_mixed", lang)))
        if partial_support:
            rationale.append(RationaleItem(code="partial_support", text=t("r_partial_support", lang)))
        for cap in caps:
            rationale.append(RationaleItem(code=f"cap_{cap}", text=t(f"r_cap_{cap}", lang)))

        return EvidenceAssessment(
            level=level.value, grade=info.grade, label=level_label(level.value, lang), score=score,
            description=info.description, rationale=rationale, n_sources=len(unique),
            design_breakdown=design_counts, credibility_breakdown=cred_counts,
            year_range=[years[0], years[-1]] if years else None,
            languages=sorted({i.source.language for i in unique}), consistency=consistency,  # type: ignore[arg-type]
            caps_applied=caps, strongest_source=strongest,
        )
