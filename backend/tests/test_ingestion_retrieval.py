from sqlalchemy import select

from app.db.models import DocumentRow
from app.retrieval.vectorstores.base import SearchFilters
from tests.helpers import make_pdf


def docs_by_title(container) -> dict[str, DocumentRow]:
    with container.db.session() as session:
        return {d.title: d for d in session.scalars(select(DocumentRow))}


def test_initial_sync_classifies_and_indexes(ingested):
    docs = docs_by_title(ingested)

    def find(prefix: str) -> DocumentRow:
        return next(d for t, d in docs.items() if t.split("]", 1)[-1].strip().startswith(prefix))

    by_prefix = {p: find(p) for p in ("Physical activity and cancer", "Smoking cessation and lung",
                                      "Smoking cessation after", "Alcohol intake and breast",
                                      "Guideline on physical activity")}
    meta = by_prefix["Physical activity and cancer"]
    assert (meta.source_type, meta.source_type_basis, meta.year) == ("meta_analysis", "metadata", 2021)
    smoking = by_prefix["Smoking cessation and lung"]
    assert (smoking.source_type, smoking.source_type_basis, smoking.doi) == (
        "meta_analysis", "pubmed_publication_type", "10.99999/fixture.0001")
    assert by_prefix["Smoking cessation after"].source_type == "cohort"
    alcohol = by_prefix["Alcohol intake and breast"]
    assert alcohol.year == 2019 and alcohol.topics == ["alcohol"]  # from manifest.jsonl
    assert alcohol.source_type == "cohort" and alcohol.source_type_basis == "text_heuristics"
    guideline = by_prefix["Guideline on physical activity"]
    assert (guideline.source_type, guideline.credibility) == ("guideline", "authoritative")
    french = next(d for t, d in docs.items() if "Viande" in t)
    assert french.language == "fr"
    statuses = sorted(d.status for d in docs.values())
    assert statuses.count("duplicate") == 1 and statuses.count("retracted") == 1


def test_incremental_sync_detects_changes_and_deletions(ingested, corpus):
    stats = ingested.ingestion.sync()
    assert stats.files_unchanged == stats.files_seen and not stats.changed

    (corpus / "research" / "new_pdf.pdf").write_bytes(make_pdf([[
        "Sleep and cancer survivors", "Cognitive behavioural therapy for insomnia improved sleep quality",
        "in cancer survivors compared with usual care in this randomised trial."]], title="Sleep fixture"))
    (corpus / "blogs" / "sugar_myth.txt").write_text("Changed blog text about sugar and cancer risk in adults.")
    (corpus / "guidelines" / "alcohol_prevention.md").unlink()
    stats = ingested.ingestion.sync()
    assert stats.documents_added == 1 and stats.documents_updated >= 1 and stats.documents_removed == 1
    titles = docs_by_title(ingested)
    assert "Sleep fixture" in titles
    assert not any("Alcohol and cancer prevention" in t for t in titles)


def test_removed_source_purges_documents(ingested, settings):
    import yaml

    data = yaml.safe_load(settings.data_sources_file.read_text())
    data["sources"] = [s for s in data["sources"] if s["id"] != "blogs"]
    settings.data_sources_file.write_text(yaml.safe_dump(data))
    stats = ingested.ingestion.sync()
    assert stats.documents_removed >= 2
    assert not any(d.source_id == "blogs" for d in docs_by_title(ingested).values())


def test_unreachable_source_is_reported_not_fatal(container, settings):
    import yaml

    data = yaml.safe_load(settings.data_sources_file.read_text())
    data["sources"].append({"id": "missing", "name": "Missing", "uri": "/no/such/folder"})
    settings.data_sources_file.write_text(yaml.safe_dump(data))
    stats = container.ingestion.sync()
    assert "missing" in stats.source_errors and stats.documents_added > 0


def test_hybrid_retrieval_relevance_diversity_and_filters(ingested):
    r = ingested.retriever.retrieve("Does physical activity lower the risk of colon cancer?", "en")
    assert r.evidence[0].source.title.startswith("[Test fixture] Physical activity")
    assert r.answerability >= ingested.settings.answerability_threshold
    per_doc = {}
    for e in r.evidence:
        per_doc[e.source.document_id] = per_doc.get(e.source.document_id, 0) + 1
    assert max(per_doc.values()) <= ingested.settings.retrieval_max_chunks_per_document
    assert [e.n for e in r.evidence] == list(range(1, len(r.evidence) + 1))

    only_guidelines = ingested.retriever.retrieve("physical activity", "en",
                                                  filters=SearchFilters(source_types=["guideline"]))
    assert {e.source.source_type for e in only_guidelines.evidence} == {"guideline"}


def test_retracted_and_duplicates_never_retrieved(ingested):
    r = ingested.retriever.retrieve("supplement prevents all cancers retracted", "en", min_relevance=0.0)
    assert not any("Retracted" in e.source.title for e in r.evidence)
    r = ingested.retriever.retrieve("Does sugar feed cancer?", "en")
    assert sum("sugar feed cancer" in e.source.title for e in r.evidence) == 1


def test_french_query_finds_french_document(ingested):
    r = ingested.retriever.retrieve("La viande transformée augmente-t-elle le risque de cancer colorectal ?", "fr")
    assert r.evidence[0].source.language == "fr"


def test_off_topic_questions_are_not_answerable(ingested):
    for question in ["Is radon at home a cause of lung cancer?", "How effective is mammography screening?",
                     "What is the capital of France?"]:
        r = ingested.retriever.retrieve(question, "en")
        assert r.answerability < ingested.settings.answerability_threshold, question


def test_local_index_persists_across_restarts(ingested, settings):
    from app.container import Container

    ingested.store.persist()
    fresh = Container(settings)
    assert fresh.store.count() == ingested.store.count() > 0
