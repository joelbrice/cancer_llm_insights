from datetime import date

import pytest

from app.evidence.grading import EvidenceGrader, GradedSource, document_quality, recency_factor, source_ref
from app.evidence.taxonomy import SourceType
from app.evidence.verification import ClaimVerifier, is_factual_claim, parse_citations
from app.schemas.evidence import EvidenceChunk


def src(doc_id: str, stype: str, cred: str = "peer_reviewed", year: int | None = None, lang: str = "en"):
    year = year or date.today().year - 2
    return source_ref({"document_id": doc_id, "title": doc_id, "source_type": stype, "credibility": cred,
                       "year": year, "language": lang})


grader = EvidenceGrader()


def test_quality_follows_the_evidence_pyramid():
    year = date.today().year - 2
    order = ["meta_analysis", "rct", "cohort", "case_control", "cross_sectional", "blog"]
    scores = [document_quality(t, "peer_reviewed", year) for t in order]
    assert scores == sorted(scores, reverse=True)
    assert document_quality("guideline", "authoritative", year) > document_quality("guideline", "general", year)
    assert recency_factor(date.today().year - 30, SourceType.COHORT) < recency_factor(date.today().year,
                                                                                      SourceType.COHORT)


def test_insufficient_without_sources():
    a = grader.assess([], "en")
    assert a.level == "insufficient" and a.n_sources == 0 and a.rationale[0].code == "none"


def test_high_for_concordant_syntheses_and_guideline():
    a = grader.assess([GradedSource(src("m1", "meta_analysis"), 0.9), GradedSource(src("m2", "systematic_review"), 0.8),
                       GradedSource(src("g", "guideline", "authoritative"), 0.9)], "en", consistency="consistent")
    assert a.level == "high" and a.grade == "A"
    codes = {r.code for r in a.rationale}
    assert {"sources", "designs", "strongest", "authoritative", "consistent"} <= codes


def test_blogs_only_capped_very_low():
    a = grader.assess([GradedSource(src("b1", "blog", "general"), 1.0), GradedSource(src("b2", "news", "general"), 1.0)],
                      "en")
    assert a.level == "very_low" and "secondary_only" in a.caps_applied


def test_preclinical_only_capped_low():
    a = grader.assess([GradedSource(src(f"p{i}", "preclinical", "peer_reviewed"), 1.0) for i in range(5)], "en")
    assert a.level in ("low", "very_low") and "no_human" in a.caps_applied


def test_observational_only_capped_moderate_with_explanation():
    a = grader.assess([GradedSource(src(f"c{i}", "cohort", "peer_reviewed"), 1.0) for i in range(6)], "en",
                      consistency="consistent")
    assert a.level == "moderate" and "observational" in a.caps_applied
    assert any(r.code == "observational" for r in a.rationale)


def test_single_source_and_mixed_findings_penalised():
    single = grader.assess([GradedSource(src("r", "rct"), 0.9)], "en")
    double = grader.assess([GradedSource(src("r", "rct"), 0.9), GradedSource(src("r2", "rct"), 0.9)], "en")
    mixed = grader.assess([GradedSource(src("r", "rct"), 0.9), GradedSource(src("r2", "rct"), 0.9)], "en",
                          consistency="mixed")
    assert single.score < double.score and mixed.score < double.score
    assert any(r.code == "single_source" for r in single.rationale)


def test_duplicate_chunks_of_one_document_count_once():
    a = grader.assess([GradedSource(src("same", "rct"), 0.4), GradedSource(src("same", "rct"), 0.9)], "en")
    assert a.n_sources == 1


def test_rationale_is_localised():
    a = grader.assess([GradedSource(src("m1", "meta_analysis"), 0.9)], "fr")
    assert a.label in ("Élevé", "Modéré", "Faible", "Très faible")
    assert a.rationale[0].text.startswith("Fondé sur 1 source")


# ── verification ─────────────────────────────────────────────────────────────
def ev(n: int, text: str, doc: str, lang: str = "en", stype: str = "cohort") -> EvidenceChunk:
    return EvidenceChunk(n=n, chunk_id=f"{doc}:0", source=src(doc, stype, lang=lang), text=text, relevance=0.9)


EVIDENCE = [
    ev(1, "Higher physical activity was associated with a lower risk of colon cancer. Effects were consistent.", "a"),
    ev(2, "Alcohol consumption increased breast cancer risk by 7% per daily drink.", "b"),
    ev(3, "Physical activity showed no significant association with colon cancer risk in this small study.", "c"),
]


def test_parse_citations_ranges_and_bounds():
    assert parse_citations("x [1][3] and [2, 4-5] [99]", 5) == [1, 3, 2, 4, 5]


def test_claim_detection():
    assert not is_factual_claim("What does the research say?")
    assert not is_factual_claim("Here is what the sources in the library say:")
    assert not is_factual_claim("Talk with your doctor or care team before making major changes.")
    assert is_factual_claim("Physical activity lowers the risk of colon cancer [1].")


@pytest.fixture()
def verifier(settings):
    return ClaimVerifier(settings)


def test_supported_unsupported_and_uncited_claims(verifier):
    answer = ("Higher physical activity is associated with a lower risk of colon cancer [1]. "
              "Drinking green tea cures pancreatic cancer [1]. "
              "Alcohol consumption increases breast cancer risk.")
    v, citations, _ = verifier.verify(answer, EVIDENCE, "en")
    labels = [c.label for c in v.claims]
    assert labels == ["supported", "unsupported", "no_citation"]
    assert v.claims[2].best_citation == 2  # suggests the passage that would support it
    assert v.unsupported == 2
    assert citations[0].n == 1 and "lower risk of colon cancer" in citations[0].quote
    assert citations[0].passage[citations[0].quote_start:citations[0].quote_end] == citations[0].quote


def test_hallucinated_number_is_flagged(verifier):
    v, _, _ = verifier.verify("Alcohol increased breast cancer risk by 25% per daily drink [2].", EVIDENCE, "en")
    assert "number_not_in_source" in v.claims[0].issues and v.claims[0].label != "supported"
    v, _, _ = verifier.verify("Alcohol increased breast cancer risk by 7% per daily drink [2].", EVIDENCE, "en")
    assert v.claims[0].label == "supported"


def test_conflicting_sources_marked_mixed(verifier):
    _, _, consistency = verifier.verify(
        "Physical activity is associated with colon cancer risk [1][3].", EVIDENCE, "en")
    assert consistency == "mixed"


def test_verify_points_inherit_citations_per_sentence(verifier):
    results, _, _, _ = verifier.verify_points(
        [("Higher physical activity was associated with a lower risk of colon cancer. Effects were consistent "
          "across the included studies.", [1]),
         ("Green tea cures every cancer known to medicine.", [2])], EVIDENCE, "en")
    assert results[0][1] in ("supported", "partial")
    assert results[1][1] == "unsupported"
