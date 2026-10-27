from app.core.language import detect_language
from app.core.pii import scrub
from app.core.text import (
    analyze,
    extract_numbers,
    idf_weights,
    sentence_spans,
    slugify,
    weighted_coverage,
)


def test_sentence_spans_offsets_abbreviations_and_citations():
    text = ("Smith et al. found a lower risk (p. 4). The RR was 0.84 [1, 2]. ¿Qué es? Es algo.\n\n"
            "Intro line:\n• First point is here. [1]\n• Second point [2]. Third one [3][4].")
    spans = sentence_spans(text)
    assert all(text[s.start:s.end] == s.text for s in spans)
    texts = [s.text for s in spans]
    assert texts[0] == "Smith et al. found a lower risk (p. 4)."
    assert "The RR was 0.84 [1, 2]." in texts
    assert "¿Qué es?" in texts
    assert "Intro line:" in texts
    assert "• First point is here. [1]" in texts  # trailing marker stays with its sentence
    assert "Third one [3][4]." in texts


def test_soft_wrapped_lines_join_but_bullets_split():
    text = "A sentence wrapped\nacross two lines. Next sentence.\n- bullet one\n- bullet two"
    texts = [s.text for s in sentence_spans(text)]
    assert texts[0] == "A sentence wrapped\nacross two lines."
    assert texts[-2:] == ["- bullet one", "- bullet two"]


def test_analyze_multilingual_stemming_and_stopwords():
    assert analyze("Regular smokers increase their cancer risks", "en") == ["regular", "smoker", "increas", "cancer",
                                                                             "risk"]
    fr = analyze("Les fumeurs réguliers augmentent leurs risques de cancers", "fr")
    assert "fumeur" in fr and "cancer" in fr and "les" not in fr
    assert all(t == t.lower() for t in fr)


def test_extract_numbers_ignores_years_and_normalizes_decimals():
    assert extract_numbers("reduced risk by 20 % and RR 0,84 in 2019 among 1.5 million") == {"20", "0.84", "1.5"}


def test_idf_weighted_coverage_prefers_rare_terms_and_penalizes_unseen():
    sets = [{"cancer", "risk", "alcohol"}, {"cancer", "risk", "smoke"}, {"cancer", "risk", "activ"},
            {"cancer", "fatigu"}, {"cancer", "risk"}]
    idf = idf_weights(sets)
    assert idf["alcohol"] > idf["cancer"]
    q = {"alcohol", "cancer"}
    assert weighted_coverage(q, {"alcohol", "cancer"}, idf) == 1.0
    assert weighted_coverage(q, {"cancer"}, idf) < 0.3
    assert weighted_coverage({"radon", "cancer"}, {"cancer"}, idf) < 0.2  # unseen focus term dominates


def test_detect_language():
    supported = ["en", "fr", "es", "pt", "de"]
    assert detect_language("Does physical activity lower the risk of colon cancer?", supported) == "en"
    assert detect_language("Est-ce que l'activité physique réduit le risque de cancer ?", supported) == "fr"
    assert detect_language("¿La actividad física reduce el riesgo de cáncer de colon?", supported) == "es"
    assert detect_language("A atividade física reduz o risco de câncer? Não sei.", supported) == "pt"
    assert detect_language("Senkt Bewegung das Risiko für Darmkrebs und ist das sicher?", supported) == "de"
    assert detect_language("ok", supported, hint="fr") == "fr"


def test_scrub_pii():
    out = scrub("Mail me at jane.doe@example.org or +33 6 12 34 56 78, born 12/04/1980, see https://x.y/z")
    assert "example.org" not in out and "56 78" not in out and "1980" not in out and "https" not in out


def test_slugify():
    assert slugify("Viande transformée & cancer!") == "viande-transformee-cancer"
