import json
from pathlib import Path

import fsspec
import pytest

from app.datasources.registry import SourceRegistry, SourceSpec, load_config_sources
from app.datasources.scanner import SourceScanner, matches
from app.datasources.uri import (
    MissingEnvironmentVariable,
    interpolate_env,
    parse_source_uri,
    redact_options,
    redact_uri,
)

ROOT = Path("/project")


@pytest.mark.parametrize(("uri", "protocol", "kind"), [
    ("./data/raw/research", "file", "local"),
    ("/mnt/corpus", "file", "local"),
    ("file:///mnt/corpus", "file", "local"),
    ("s3://bucket/prefix/", "s3", "s3"),
    ("gs://bucket/prefix", "gcs", "gcs"),
    ("az://container/prefix", "az", "azure"),
    ("abfss://container@acct.dfs.core.windows.net/p", "abfs", "azure"),
    ("https://example.org/corpus/manifest.jsonl", "https", "http"),
    ("memory://corpus", "memory", "memory"),
])
def test_parse_source_uri(uri, protocol, kind):
    parsed = parse_source_uri(uri, ROOT)
    assert (parsed.protocol, parsed.kind) == (protocol, kind)
    if uri.startswith("./"):
        assert parsed.path == str((ROOT / "data/raw/research").resolve())
    if uri.endswith(".jsonl"):
        assert parsed.is_manifest


def test_parse_rejects_unknown_scheme():
    with pytest.raises(ValueError):
        parse_source_uri("ftp://host/x", ROOT)


def test_redaction():
    assert redact_uri("https://user:pass@host/x?sig=abc&v=1") == "https://host/x?sig=***&v=1"
    opts = redact_options({"key": "${AWS_ACCESS_KEY_ID}", "secret": "plain", "client_kwargs": {"region_name": "eu"}})
    assert opts == {"key": "${AWS_ACCESS_KEY_ID}", "secret": "***", "client_kwargs": {"region_name": "eu"}}


def test_interpolate_env():
    env = {"A": "1"}
    assert interpolate_env({"x": "${A}", "y": ["${B:-def}"]}, env) == {"x": "1", "y": ["def"]}
    with pytest.raises(MissingEnvironmentVariable):
        interpolate_env("${MISSING}", env)


def test_glob_matching():
    include, exclude = ["**/*.pdf", "**/*.md"], ["**/_drafts/**", "**/*.meta.yaml", "**/.*"]
    assert matches("a.pdf", include, exclude)
    assert matches("x/y/z.MD", include, exclude)
    assert not matches("_drafts/a.pdf", include, exclude)
    assert not matches("a.pdf.meta.yaml", include, exclude)
    assert not matches(".hidden.md", include, exclude)
    assert not matches("a.txt", include, exclude)


def test_config_sources_and_env_shortcut(settings, monkeypatch):
    specs = load_config_sources(settings)
    assert [s.id for s in specs] == ["research", "guidelines", "web", "blogs"]
    settings.data_source_uri = "s3://my-bucket/corpus"
    specs = load_config_sources(settings)
    assert specs[-1].origin == "env" and specs[-1].uri == "s3://my-bucket/corpus"


def test_repository_sources_yaml_is_valid(settings):
    """The shipped data/sources.yaml must stay loadable."""
    repo_file = Path(__file__).resolve().parents[2] / "data" / "sources.yaml"
    settings.data_sources_file = repo_file
    ids = [s.id for s in load_config_sources(settings)]
    assert {"local-research", "local-guidelines", "local-web", "local-blogs"} <= set(ids)


def test_bucket_scan_with_sidecar_and_manifest(settings):
    """memory:// behaves like an object store (S3/GCS/Azure) — same code path as real buckets."""
    fs = fsspec.filesystem("memory")
    fs.pipe("/bucket/corpus/a.md", b"# Title A\n\nSome body text about physical activity and colon cancer risk.")
    fs.pipe("/bucket/corpus/a.md.meta.yaml", b"year: 2020\nsource_type: cohort\n")
    fs.pipe("/bucket/corpus/sub/b.txt", b"Body B about alcohol and cancer risk in adults.")
    fs.pipe("/bucket/corpus/manifest.jsonl", json.dumps({"path": "sub/b.txt", "year": 2018}).encode())
    fs.pipe("/bucket/corpus/_drafts/c.md", b"draft")
    spec = SourceSpec(id="mem", name="Memory bucket", uri="memory://bucket/corpus")
    files = {f.path: f for f in SourceScanner(settings).scan(spec)}
    assert set(files) == {"a.md", "sub/b.txt"}
    assert files["a.md"].metadata == {"year": 2020, "source_type": "cohort"}
    assert files["sub/b.txt"].metadata == {"year": 2018}
    assert "meta:" in files["a.md"].fingerprint
    assert SourceScanner(settings).read_bytes(spec, files["sub/b.txt"]).startswith(b"Body B")


def test_missing_local_folder_raises(settings):
    spec = SourceSpec(id="nope", name="Nope", uri="/definitely/not/here")
    with pytest.raises(FileNotFoundError):
        list(SourceScanner(settings).scan(spec))


def test_registry_crud_and_validation(container):
    registry: SourceRegistry = container.registry
    registry.sync_config()
    created = registry.create(SourceSpec(id="api-mem", name="API", uri="memory://x"))
    assert created.origin == "api"
    with pytest.raises(ValueError):
        registry.create(SourceSpec(id="api-mem", name="dup", uri="memory://y"))
    assert registry.update("api-mem", {"enabled": False}).enabled is False
    with pytest.raises(ValueError):
        registry.update("research", {"uri": "/elsewhere"})  # config sources are file-managed
    registry.delete("api-mem")
    assert registry.get("api-mem") is None
