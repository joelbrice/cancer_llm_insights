"""Operations CLI:  python -m app.cli --help"""

from __future__ import annotations

import json
from typing import Annotated

import typer

from app.core.logging import configure_logging

app = typer.Typer(add_completion=False, help="Stepwell engine operations", no_args_is_help=True)


def _container():
    from app.container import get_container

    container = get_container()
    configure_logging(container.settings.log_level, container.settings.log_json)
    return container


def _print(data) -> None:
    typer.echo(json.dumps(data, indent=2, ensure_ascii=False, default=str))


@app.command()
def serve(host: str = "0.0.0.0", port: int = 8000, reload: bool = False, workers: int = 1) -> None:
    """Run the API server."""
    import uvicorn

    uvicorn.run("app.main:app_factory", factory=True, host=host, port=port, reload=reload, workers=workers,
                proxy_headers=True, forwarded_allow_ips="*")


@app.command()
def ingest(
    source: Annotated[list[str] | None, typer.Option("--source", "-s", help="Source id (repeatable)")] = None,
    full: Annotated[bool, typer.Option(help="Re-process every file")] = False,
    insights: Annotated[bool, typer.Option(help="Build insights afterwards")] = True,
) -> None:
    """Scan linked sources (local folders / buckets) and index new or changed documents."""
    c = _container()
    stats = c.ingestion.sync(source or None, "full" if full else "incremental",
                             progress=lambda f, m: typer.echo(f"[{f:5.0%}] {m}", err=True))
    _print(stats.as_dict())
    if insights and stats.changed:
        build_insights()


@app.command("build-insights")
def build_insights(
    topic: Annotated[list[str] | None, typer.Option("--topic", "-t")] = None,
    lang: Annotated[list[str] | None, typer.Option("--lang", "-l")] = None,
    force: bool = False,
) -> None:
    """Generate / refresh evidence-graded insights."""
    c = _container()
    result = c.insights.build_all(topic or None, lang or None, force,
                                  progress=lambda f, m: typer.echo(f"[{f:5.0%}] {m}", err=True))
    _print(result.as_dict())


@app.command()
def evaluate(dataset: str | None = None, k: int = 8) -> None:
    """Run the evaluation suite in data/eval/."""
    _print(_container().evaluation.run(dataset, k))


@app.command("export-sft")
def export_sft(lang: Annotated[list[str] | None, typer.Option("--lang", "-l")] = None, max_examples: int = 5000,
               distractors: int = 2) -> None:
    """Export a RAFT-style fine-tuning dataset for LLaMA into data/finetune/."""
    _print(_container().sft_export.export(lang or None, max_examples, distractors))


@app.command()
def status() -> None:
    """Show platform status (data, index, models, sources)."""
    _print(_container().platform.status().model_dump(mode="json"))


@app.command()
def sources() -> None:
    """List configured data sources (credentials redacted)."""
    from app.datasources.uri import redact_options, redact_uri

    for spec in _container().registry.sync_config():
        _print({**spec.model_dump(), "uri": redact_uri(spec.uri), "storage_options": redact_options(spec.storage_options)})


@app.command("test-source")
def test_source(source_id: str) -> None:
    """Check connectivity to a source and list a sample of files."""
    c = _container()
    spec = c.registry.get(source_id) or next((s for s in c.registry.sync_config() if s.id == source_id), None)
    if spec is None:
        raise typer.BadParameter(f"unknown source {source_id}")
    c.registry.validate(spec)
    _print(c.scanner.test(spec, sample=20))


@app.command()
def ask(question: str, lang: str | None = None) -> None:
    """Ask a question from the terminal (non-streaming)."""
    import asyncio

    from app.schemas.api import ChatMessage, ChatRequest

    c = _container()
    response = asyncio.run(c.chat.answer(ChatRequest(messages=[ChatMessage(role="user", content=question)],
                                                     language=lang, stream=False)))
    typer.echo(response.answer)
    typer.echo("")
    for cit in response.citations:
        typer.echo(f"[{cit.n}] {cit.source.title} ({cit.source.source_type_label}, {cit.source.year}) "
                   f"support={cit.support} — “{cit.quote[:160]}”")
    if response.evidence:
        typer.echo(f"\nEvidence: {response.evidence.label} ({response.evidence.grade}, score {response.evidence.score})")


@app.command("reset-index")
def reset_index(yes: Annotated[bool, typer.Option("--yes", help="Confirm")] = False) -> None:
    """Delete all indexed documents and vectors (needed after changing the embedding model)."""
    if not yes:
        raise typer.BadParameter("pass --yes to confirm")
    _container().ingestion.reset()
    typer.echo("index reset — run `ingest --full` to rebuild")


@app.command()
def doctor() -> None:
    """Check configuration and connectivity of every dependency."""
    import asyncio

    c = _container()
    s = c.settings
    checks: dict[str, object] = {}
    try:
        checks["database"] = c.db.ping()
    except Exception as exc:
        checks["database"] = f"FAIL {exc}"
    checks["vector_store"] = f"{c.store.name} healthy={c.store.health()} vectors={c.store.count()}"
    checks["embeddings"] = f"{s.embedding_provider} {c.embedder.name} dim={c.embedder.dim}"
    checks["llm"] = (f"{s.llm_provider} {s.llm_model} reachable={asyncio.run(c.llm.health())}" if c.llm
                     else "extractive (no generative model configured)")
    checks["admin_api_key"] = "set" if s.admin_api_key else "NOT SET (admin API open in development)"
    checks["sources"] = {}
    for spec in c.registry.sync_config():
        try:
            c.registry.validate(spec)
            sample = c.scanner.test(spec, sample=3)
            checks["sources"][spec.id] = f"ok ({len(sample['sample'])}+ files)" if sample["sample"] else "ok (empty)"
        except Exception as exc:
            checks["sources"][spec.id] = f"FAIL {type(exc).__name__}: {exc}"
    _print(checks)


if __name__ == "__main__":
    app()
