from __future__ import annotations

import shutil
from pathlib import Path

import pytest
import yaml

from app.container import Container, set_container
from app.settings import Settings

FIXTURES = Path(__file__).parent / "fixtures"
CORPUS = FIXTURES / "corpus"


def write_sources(path: Path, corpus: Path) -> None:
    sources = {
        "version": 1,
        "sources": [
            {"id": "research", "name": "Research", "uri": str(corpus / "research"),
             "defaults": {"source_type": "auto", "credibility": "peer_reviewed"}},
            {"id": "guidelines", "name": "Guidelines", "uri": str(corpus / "guidelines"),
             "defaults": {"source_type": "guideline", "credibility": "authoritative"}},
            {"id": "web", "name": "Web", "uri": str(corpus / "web"),
             "defaults": {"source_type": "institutional_web", "credibility": "reputable"}},
            {"id": "blogs", "name": "Blogs", "uri": str(corpus / "blogs"),
             "defaults": {"source_type": "blog", "credibility": "general"}},
        ],
    }
    path.write_text(yaml.safe_dump(sources), encoding="utf-8")


def make_settings(tmp: Path, corpus: Path, **overrides) -> Settings:
    data = tmp / "data"
    data.mkdir(parents=True, exist_ok=True)
    (data / "eval").mkdir(exist_ok=True)
    sources = tmp / "sources.yaml"
    write_sources(sources, corpus)
    values = dict(
        environment="test", data_dir=data, data_sources_file=sources, database_url=f"sqlite:///{data / 'test.db'}",
        sync_interval_seconds=0, run_scheduler=False, embedding_provider="hashing", llm_provider="extractive",
        insight_languages=["en", "fr"], insight_min_sources=2, rate_limit_per_minute=10_000,
        chat_rate_limit_per_minute=10_000, admin_api_key=None, log_level="WARNING",
    )
    values.update(overrides)
    return Settings(**values)


@pytest.fixture()
def corpus(tmp_path: Path) -> Path:
    """A private, mutable copy of the fixture corpus."""
    target = tmp_path / "corpus"
    shutil.copytree(CORPUS, target)
    return target


@pytest.fixture()
def settings(tmp_path: Path, corpus: Path) -> Settings:
    return make_settings(tmp_path, corpus)


@pytest.fixture()
def container(settings: Settings):
    c = Container(settings)
    set_container(c)
    yield c
    c.close()
    set_container(None)


@pytest.fixture()
def ingested(container: Container) -> Container:
    stats = container.ingestion.sync()
    assert stats.documents_failed == 0, stats.errors
    return container


@pytest.fixture()
def client(container: Container):
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app(container.settings, container)) as test_client:
        yield test_client


# Session-scoped, fully built platform (ingested + insights) shared by read-only tests.
@pytest.fixture(scope="session")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("built")
    corpus_copy = tmp / "corpus"
    shutil.copytree(CORPUS, corpus_copy)
    c = Container(make_settings(tmp, corpus_copy))
    set_container(c)
    c.ingestion.sync()
    c.insights.build_all()
    yield c
    c.close()
    set_container(None)


@pytest.fixture()
def built_client(built: Container):
    from fastapi.testclient import TestClient

    from app.main import create_app

    set_container(built)
    with TestClient(create_app(built.settings, built)) as test_client:
        yield test_client
