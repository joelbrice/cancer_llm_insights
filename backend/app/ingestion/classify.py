"""Study-design classification (meta-analysis, RCT, cohort …) with provenance and confidence.

Precedence (highest first):
1. explicit metadata (`source_type` in sidecar/manifest/record)        → confidence 1.0
2. PubMed publication types / JATS article-type                          → 0.9–0.95
3. the source default from sources.yaml (unless `auto`)                  → 0.7
4. multilingual text heuristics on title (weighted) + abstract window    → 0.45–0.8
5. unknown                                                               → 0.0
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.evidence.taxonomy import SourceType, coerce_source_type


@dataclass(frozen=True, slots=True)
class Classification:
    source_type: SourceType
    confidence: float
    basis: str


PUBMED_TYPES: list[tuple[str, SourceType]] = [
    ("retracted publication", SourceType.UNKNOWN),
    ("meta-analysis", SourceType.META_ANALYSIS),
    ("systematic review", SourceType.SYSTEMATIC_REVIEW),
    ("practice guideline", SourceType.GUIDELINE),
    ("guideline", SourceType.GUIDELINE),
    ("consensus development conference", SourceType.GUIDELINE),
    ("randomized controlled trial", SourceType.RCT),
    ("pragmatic clinical trial", SourceType.RCT),
    ("clinical trial, phase iii", SourceType.RCT),
    ("equivalence trial", SourceType.RCT),
    ("observational study", SourceType.COHORT),
    ("comparative study", SourceType.COHORT),
    ("case reports", SourceType.CASE_SERIES),
    ("review", SourceType.NARRATIVE_REVIEW),
    ("editorial", SourceType.EXPERT_OPINION),
    ("comment", SourceType.EXPERT_OPINION),
    ("letter", SourceType.EXPERT_OPINION),
    ("news", SourceType.NEWS),
]

JATS_TYPES = {
    "systematic-review": SourceType.SYSTEMATIC_REVIEW,
    "meta-analysis": SourceType.META_ANALYSIS,
    "review-article": SourceType.NARRATIVE_REVIEW,
    "case-report": SourceType.CASE_SERIES,
    "editorial": SourceType.EXPERT_OPINION,
    "letter": SourceType.EXPERT_OPINION,
    "news": SourceType.NEWS,
    "practice-guideline": SourceType.GUIDELINE,
}

# (pattern, type, weight) — multilingual (en/fr/es/pt/de)
_PATTERNS: list[tuple[re.Pattern[str], SourceType, float]] = [
    (re.compile(r"umbrella review|review of (systematic )?reviews|overview of (systematic )?reviews|revue parapluie"),
     SourceType.UMBRELLA_REVIEW, 3.0),
    (re.compile(r"meta[- ]?analy[sz](is|es)|méta[- ]?analyse|meta[- ]?análisis|metanálise|meta[- ]?análise|"
                r"metaanalyse|pooled analysis"), SourceType.META_ANALYSIS, 2.6),
    (re.compile(r"systematic (literature )?review|revue systématique|revisión sistemática|revisão sistemática|"
                r"systematische[rn]? (übersicht|review)|we searched (pubmed|medline|embase|the cochrane)"),
     SourceType.SYSTEMATIC_REVIEW, 2.4),
    (re.compile(r"\bguidelines?\b|position statement|consensus statement|recommendations? (for|on) |"
                r"recommandations|guía de práctica clínica|diretriz(es)?|leitlinie|expert report|"
                r"european code against cancer|code européen contre le cancer"), SourceType.GUIDELINE, 2.0),
    (re.compile(r"randomi[sz]ed (controlled |clinical |placebo[- ]controlled )?trial|\brct\b|"
                r"essai (contrôlé )?randomisé|ensayo (clínico )?(aleatorizado|controlado aleatorio)|"
                r"ensaio (clínico )?randomizado|randomisierte[rn]? (kontrollierte[rn]? )?studie"),
     SourceType.RCT, 2.2),
    (re.compile(r"prospective (cohort|study)|cohort study|cohort of \d|follow[- ]up of \d[\d,]* (participants|"
                r"adults|women|men)|étude de cohorte|estudio de cohorte|estudo de coorte|kohortenstudie|"
                r"\bcohort\b"), SourceType.COHORT, 1.6),
    (re.compile(r"case[- ]control|cas[- ]témoins|casos y controles|caso[- ]controle|fall[- ]kontroll"),
     SourceType.CASE_CONTROL, 1.8),
    (re.compile(r"cross[- ]sectional|étude transversale|estudio transversal|estudo transversal|querschnitt"),
     SourceType.CROSS_SECTIONAL, 1.6),
    (re.compile(r"case report|case series|rapport de cas|série de cas|reporte de caso|relato de caso|fallbericht"),
     SourceType.CASE_SERIES, 1.6),
    (re.compile(r"\bin vitro\b|\bmice\b|\bmurine\b|\brats?\b|xenograft|cell lines?|animal model|souris|ratones|"
                r"camundongos|mäuse"), SourceType.PRECLINICAL, 1.2),
    (re.compile(r"\b(narrative |literature )?review\b|revue de la littérature|revisión de la literatura|"
                r"revisão de literatura|übersichtsarbeit"), SourceType.NARRATIVE_REVIEW, 0.9),
    (re.compile(r"\beditorial\b|commentary|perspective|viewpoint|éditorial|editorial|kommentar"),
     SourceType.EXPERT_OPINION, 1.0),
]

_HUMAN_STUDY = re.compile(r"participants|patients|women|men|adults|children|survivors|population|people|"
                          r"individuals|participantes|pacientes|patientes|personnes|teilnehmer")


def _from_publication_types(pub_types: list[str]) -> SourceType | None:
    lowered = [p.lower() for p in pub_types]
    for needle, stype in PUBMED_TYPES:
        if any(needle == p or needle in p for p in lowered):
            return stype
    return None


def classify(
    *,
    title: str,
    text: str,
    metadata: dict[str, Any],
    hints: dict[str, Any],
    source_default: str | None,
) -> Classification:
    explicit = coerce_source_type(metadata.get("source_type"))
    if explicit and explicit != SourceType.UNKNOWN and metadata.get("source_type") != "auto":
        return Classification(explicit, 1.0, "metadata")

    if hints.get("publication_types"):
        stype = _from_publication_types(hints["publication_types"])
        if stype and stype != SourceType.UNKNOWN:
            return Classification(stype, 0.95, "pubmed_publication_type")
    # JATS "review-article" is often a systematic review, so it is refined by the text heuristics below
    jats_type = JATS_TYPES.get(str(hints.get("jats_article_type") or "").lower())
    if jats_type and jats_type != SourceType.NARRATIVE_REVIEW:
        return Classification(jats_type, 0.9, "jats_article_type")

    default = coerce_source_type(source_default) if source_default and source_default != "auto" else None
    if default:
        return Classification(default, 0.7, "source_default")

    scores: dict[SourceType, float] = {}
    title_l, head = title.lower(), text[:3500].lower()
    for pattern, stype, weight in _PATTERNS:
        if pattern.search(title_l):
            scores[stype] = scores.get(stype, 0.0) + weight * 2.0
        hits = len(pattern.findall(head))
        if hits:
            scores[stype] = scores.get(stype, 0.0) + weight * min(hits, 3) * 0.5
    if SourceType.PRECLINICAL in scores and _HUMAN_STUDY.search(head):
        scores[SourceType.PRECLINICAL] *= 0.3  # human studies often mention animal work in the background
    if SourceType.META_ANALYSIS in scores and SourceType.SYSTEMATIC_REVIEW in scores:
        scores[SourceType.META_ANALYSIS] += 1.0  # "systematic review and meta-analysis" → meta-analysis
    if not scores:
        return Classification(SourceType.UNKNOWN, 0.0, "none")
    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values())
    confidence = round(min(0.8, 0.45 + 0.35 * scores[best] / total), 2)
    return Classification(best, confidence, "text_heuristics")
