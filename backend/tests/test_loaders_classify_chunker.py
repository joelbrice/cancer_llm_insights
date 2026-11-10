import json

import pytest

from app.evidence.taxonomy import SourceType
from app.ingestion.chunker import chunk_blocks
from app.ingestion.classify import classify
from app.ingestion.loaders import Block, LoaderError, load_bytes
from app.ingestion.metadata import CredibilityRegistry, extract_from_text, normalize_metadata
from tests.conftest import CORPUS
from tests.helpers import make_pdf


def test_pdf_loader_pages_sections_and_reference_removal():
    pdf = make_pdf([
        ["Exercise and cancer outcomes", "", "ABSTRACT", "Regular exercise improved quality of life in survivors.",
         "Fatigue was reduced in the intervention group compared with control."],
        ["RESULTS", "Benefits were consistent across cancer types and ages in this trial."],
        ["References", "1. Fixture A et al. (2020). Some title. doi:10.1/xyz"],
    ], title="Exercise and cancer outcomes")
    [doc] = load_bytes(pdf, "paper.pdf", "pdf")
    assert doc.metadata["title"] == "Exercise and cancer outcomes"
    assert doc.metadata["_pages"] == 3
    assert {b.page for b in doc.blocks} == {1, 2}
    assert any(b.section == "Results" for b in doc.blocks)
    assert "Fixture A et al." not in doc.text  # reference list dropped


def test_pdf_without_text_raises():
    with pytest.raises(LoaderError):
        load_bytes(make_pdf([[]]), "scan.pdf", "pdf")


def test_html_loader_strips_boilerplate_and_reads_citation_meta():
    data = (CORPUS / "guidelines" / "activity_guideline.html").read_bytes()
    [doc] = load_bytes(data, "g.html", "html")
    assert doc.metadata["title"].startswith("[Test fixture] Guideline")
    assert doc.metadata["published_date"] == "2020-11-25"
    assert doc.metadata["language"] == "en"
    assert "cookies" not in doc.text and "Footer" not in doc.text and "Home · About" not in doc.text
    assert "must not be indexed" not in doc.text  # references section removed
    assert any(b.section == "Recommendations" for b in doc.blocks)


def test_markdown_front_matter_and_sections():
    [doc] = load_bytes((CORPUS / "research" / "activity_meta.md").read_bytes(), "a.md", "md")
    assert doc.metadata["source_type"] == "meta_analysis" and doc.metadata["year"] == 2021
    assert [b.section for b in doc.blocks][:1] == ["Abstract"]


def test_jsonl_records_and_csv():
    docs = load_bytes((CORPUS / "research" / "exercise_treatment.jsonl").read_bytes(), "e.jsonl", "jsonl")
    assert [d.record_key for d in docs] == ["fixture-exercise-rct", "fixture-exercise-review"]
    assert docs[0].blocks[0].section == "Abstract"
    csv_docs = load_bytes(b"title,abstract,year\nT1,Some abstract text here.,2020\n", "x.csv", "csv")
    assert csv_docs[0].metadata["title"] == "T1" and csv_docs[0].metadata["year"] == "2020"
    with pytest.raises(LoaderError):
        load_bytes(json.dumps([{"title": "no text"}]).encode(), "x.json", "json")


def test_pubmed_xml_publication_types():
    docs = load_bytes((CORPUS / "research" / "pubmed_smoking.xml").read_bytes(), "p.xml", "xml")
    assert [d.metadata["pmid"] for d in docs] == ["99000001", "99000002"]
    assert docs[0].metadata["doi"] == "10.99999/fixture.0001"
    assert "Meta-Analysis" in docs[0].hints["publication_types"]
    assert docs[0].blocks[1].section == "Abstract — Results"


def test_sniffing_overrides_wrong_extension():
    [doc] = load_bytes(b"<!doctype html><html><body><p>Hello world from an html file named txt.</p></body></html>",
                       "x.txt", "txt")
    assert "Hello world" in doc.text


@pytest.mark.parametrize(("title", "text", "meta", "hints", "default", "expected", "basis"), [
    ("x", "", {"source_type": "rct"}, {}, None, SourceType.RCT, "metadata"),
    ("x", "", {}, {"publication_types": ["Journal Article", "Meta-Analysis"]}, "auto", SourceType.META_ANALYSIS,
     "pubmed_publication_type"),
    ("x", "", {}, {}, "guideline", SourceType.GUIDELINE, "source_default"),
    ("Effects of diet: a systematic review and meta-analysis", "We searched PubMed and Embase.", {}, {}, "auto",
     SourceType.META_ANALYSIS, "text_heuristics"),
    ("Essai randomisé de l'activité physique", "Un essai contrôlé randomisé chez 300 patients.", {}, {}, "auto",
     SourceType.RCT, "text_heuristics"),
    ("Coffee and liver cancer", "In this prospective cohort study of 50,000 adults...", {}, {}, "auto",
     SourceType.COHORT, "text_heuristics"),
    ("Curcumin in mice", "Xenograft tumours in mice were treated in vitro and in vivo.", {}, {}, "auto",
     SourceType.PRECLINICAL, "text_heuristics"),
    ("Hello", "Nothing to see.", {}, {}, None, SourceType.UNKNOWN, "none"),
])
def test_classification(title, text, meta, hints, default, expected, basis):
    result = classify(title=title, text=text, metadata=meta, hints=hints, source_default=default)
    assert result.source_type == expected and result.basis == basis
    assert 0 <= result.confidence <= 1


def test_metadata_normalisation_and_extraction():
    meta = normalize_metadata({"Authors": "A; B", "doi": "https://doi.org/10.1000/ABC.1.", "pmid": "PMID: 123456",
                               "year": "c. 2019", "retracted": "yes", "custom": 1, "_private": 2})
    assert meta == {"authors": ["A", "B"], "doi": "10.1000/ABC.1", "pmid": "123456", "year": 2019, "retracted": True,
                    "extra": {"custom": 1}}
    found = extract_from_text("Journal 2021; doi:10.1234/xyz.5 PMID: 3456789")
    assert found == {"doi": "10.1234/xyz.5", "pmid": "3456789", "year": 2021}


def test_credibility_registry():
    registry = CredibilityRegistry()
    cred, publisher = registry.lookup("https://www.iarc.who.int/news")
    assert cred.value == "authoritative" and "IARC" in publisher
    assert registry.lookup(None, "The Lancet Oncology")[0].value == "peer_reviewed"
    assert registry.lookup("https://random-blog.example") == (None, None)


def test_chunker_offsets_sections_pages_and_overlap():
    sentences = [f"Sentence number {i} talks about physical activity and the risk of colon cancer." for i in range(60)]
    blocks = [Block(" ".join(sentences[:30]), "Results", 1), Block(" ".join(sentences[30:]), "Discussion", 2)]
    doc_text, chunks = chunk_blocks(blocks, chunk_size=120, overlap=30)
    assert len(chunks) > 4
    for c in chunks:
        assert doc_text[c.char_start:c.char_end] == c.text
        assert c.token_count <= 120 + 30
    assert chunks[0].section == "Results" and chunks[-1].section == "Discussion"
    assert chunks[-1].page_start == 2
    first_two = chunks[0].text, chunks[1].text  # consecutive chunks share overlapping sentences
    assert first_two[0].split(". ")[-1].rstrip(".") in first_two[1]


def test_chunker_drops_reference_residue():
    refs = "Fixture A et al. (2019) doi:10.1/a. Fixture B et al. (2020) doi:10.1/b. Fixture C et al. (2021) doi:10.1/c."
    _, chunks = chunk_blocks([Block(refs * 3)], chunk_size=300)
    assert chunks == []
