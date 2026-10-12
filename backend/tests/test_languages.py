"""Italian and Arabic (roadmap 1.2), and the guarantee that adding them changes nothing for the original five
languages: language identification, shared stopword/filler tables, topic vectors and anchor matching."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.language import detect_language
from app.core.text import QUERY_FILLERS, STOPWORDS, analyze, split_sentences, stopwords
from app.safety.guardrails import Guardrails
from tests.conftest import CORPUS

BASE = ["en", "fr", "es", "pt", "de"]
ALL = [*BASE, "it", "ar"]


def corpus_sentences() -> list[str]:
    out: list[str] = []
    for path in sorted(Path(CORPUS).rglob("*")):
        if path.suffix in {".md", ".txt", ".html", ".htm"}:
            out += [s for s in split_sentences(path.read_text(encoding="utf-8", errors="ignore")) if len(s.split()) >= 4]
    return out


SAMPLES = {
    "en": ["How does alcohol affect cancer risk?", "Is it safe to exercise during chemotherapy?",
           "Can cancer come back after treatment?", "5 portions of vegetables per day"],
    "fr": ["Comment l'alcool influence-t-il le risque de cancer ?", "Il faut marcher tous les jours.",
           "Est-ce que je peux faire du sport pendant la chimio ?", "non fumeurs et cancer du poumon"],
    "es": ["¿Cómo afecta el alcohol al riesgo de cáncer?", "¿Puedo hacer ejercicio durante la quimioterapia?"],
    "pt": ["Como é que o álcool afeta o risco de cancro?", "Não sei se posso fazer exercício durante a quimioterapia."],
    "de": ["Wie beeinflusst Alkohol das Krebsrisiko?", "Darf ich während der Chemotherapie Sport treiben?"],
}


def test_adding_languages_does_not_change_how_existing_text_is_identified():
    sentences = corpus_sentences() + [s for group in SAMPLES.values() for s in group]
    assert len(sentences) > 50
    changed = [s for s in sentences
               if detect_language(s, BASE) in BASE and detect_language(s, ALL) != detect_language(s, BASE)]
    assert changed == []
    for lang, group in SAMPLES.items():
        for s in group:  # with the UI language as hint, exactly as before
            assert detect_language(s, ALL, hint=lang) == detect_language(s, BASE, hint=lang) == lang, s


@pytest.mark.parametrize(("text", "lang"), [
    ("Il fumo aumenta il rischio di tumore al polmone? Perché?", "it"),
    ("Cosa posso mangiare durante la chemio?", "it"),
    ("هل يزيد التدخين من خطر الإصابة بسرطان الرئة؟", "ar"),
])
def test_italian_and_arabic_are_identified(text, lang):
    assert detect_language(text, ALL) == lang


def test_shared_tables_stay_the_original_five():
    """The hashing embedder drops the union of STOPWORDS and every language subtracts QUERY_FILLERS: new
    languages must never be added there (they would silently change retrieval for everyone)."""
    assert set(STOPWORDS) == set(BASE)
    assert not {"come", "perch", "consigl"} & QUERY_FILLERS
    assert stopwords("it") != stopwords("en") and "della" in stopwords("it")
    assert stopwords("fr") is STOPWORDS["fr"]


def test_arabic_and_italian_text_processing():
    assert split_sentences("التدخين يزيد خطر السرطان. الإقلاع عنه يقلل الخطر؟ نعم، بشكل واضح.") == [
        "التدخين يزيد خطر السرطان.", "الإقلاع عنه يقلل الخطر؟", "نعم، بشكل واضح."]
    assert split_sentences("Il a dit. «Bonjour» à tous.") == ["Il a dit. «Bonjour» à tous."]  # French unchanged
    ar = analyze("الإقلاعُ عن التدخين يقلل خطر سرطان الرئة", "ar")
    assert "اقلاع" in ar and "عن" not in ar  # diacritics and hamza normalised, stopword dropped
    assert analyze("Smettere di fumare riduce il rischio", "it") == ["smett", "fum", "riduc", "risc"]


@pytest.mark.parametrize(("text", "lang", "rule"), [
    ("Voglio farla finita, non ce la faccio più", "it", "self_harm"),
    ("اريد ان اموت", "ar", "self_harm"),
    ("Ho un dolore forte al petto e non riesco a respirare", "it", "medical_emergency"),
    ("لدي ألم شديد في الصدر ولا أستطيع التنفس", "ar", "medical_emergency"),
    ("Ho la febbre a 38,5 durante la chemio", "it", "oncologic_urgent"),
    ("لدي حمى أثناء العلاج الكيماوي", "ar", "oncologic_urgent"),
    ("Posso smettere la chemioterapia?", "it", "treatment_decision"),
    ("هل يمكنني إيقاف العلاج الكيماوي؟", "ar", "treatment_decision"),
    ("I noccioli di albicocca curano il cancro?", "it", "harmful_alternative"),
])
def test_safety_rules_cover_italian_and_arabic(text, lang, rule):
    assessment = Guardrails().check_input(text, lang, "IT" if lang == "it" else "LB")
    assert rule in assessment.flags
    if rule == "self_harm":
        assert assessment.level == "emergency" and assessment.notices[0].message
        assert any(r.contact in ("02 2327 2327", "1564") for r in assessment.resources)


def test_being_done_with_chemo_is_not_a_crisis():
    assert Guardrails().check_input("Voglio farla finita con la chemio, è troppo pesante", "it").flags == []


def test_topics_keep_base_vectors_and_scope_new_anchors(built):
    insights = built.insights
    topic = next(t for t in insights.topics if t.id == "quitting-smoking")
    base_text = insights._topic_text(topic)
    assert "Benefici di smettere" not in base_text and "فوائد" not in base_text and "Benefits of quitting smoking" in base_text
    assert "Benefici di smettere di fumare" in insights._topic_text(topic, "it")
    assert insights._vectors_for("fr") is insights._topic_vectors
    assert topic.matches_text("Ho smesso di fumare tre anni fa", "it")
    assert topic.matches_text("أقلعت عن التدخين منذ ثلاث سنوات", "ar")
    assert not topic.matches_text("Ho smesso di fumare tre anni fa", "en")  # base anchors are untouched
    assert topic.text("title", "ar") == "فوائد الإقلاع عن التدخين"


def test_italian_and_arabic_through_the_api(client):
    meta = client.get("/api/v1/community/meta", params={"lang": "ar"}).json()
    assert meta["circles"][0]["title"] == "عادات صحية" and meta["circles"][0]["prompt"]
    assert client.get("/api/v1/community/meta", params={"lang": "it"}).json()["circles"][1]["title"] == "Durante le cure"
    body = {"messages": [{"role": "user", "content": "Il vino aumenta il rischio di tumore?"}], "stream": False}
    answer = client.post("/api/v1/chat", json=body).json()  # empty library: honest message, in Italian
    assert answer["language"] == "it" and answer["abstain_reason"] == "awaiting_data"
    assert "biblioteca" in answer["answer"]
    crisis = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "أفكر في الانتحار"}],
                                               "stream": False, "profile": {"country": "LB"}}).json()
    assert crisis["language"] == "ar" and crisis["abstained"] and crisis["safety"]["level"] == "emergency"
    assert "1564" in str(crisis["safety"]["resources"])


def test_insights_are_built_in_italian_and_arabic(ingested):
    ingested.insights.build_all(topic_ids=["quitting-smoking"], languages=["it", "ar"])
    it = ingested.insights.get("quitting-smoking.it")
    ar = ingested.insights.get("quitting-smoking.ar")
    assert it and it.title == "Benefici di smettere di fumare" and it.question.startswith("Cosa succede")
    assert ar and ar.title == "فوائد الإقلاع عن التدخين"
    assert it.status == ar.status == "published" and it.citations
    assert any("lingua originale" in limitation for limitation in it.limitations)
