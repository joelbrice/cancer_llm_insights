"""Data source registry: merges `data/sources.yaml`, the DATA_SOURCE_URI shortcut and API-created sources."""

from __future__ import annotations

import logging
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from app.core.text import slugify
from app.datasources.uri import EXTRA_FOR_PROTOCOL, ParsedURI, drop_empty, interpolate_env, parse_source_uri
from app.db.base import Database
from app.db.models import DataSourceRow
from app.settings import Settings

log = logging.getLogger(__name__)

DEFAULT_INCLUDE = ["**/*.pdf", "**/*.html", "**/*.htm", "**/*.md", "**/*.txt", "**/*.json", "**/*.jsonl",
                   "**/*.csv", "**/*.docx", "**/*.xml"]
DEFAULT_EXCLUDE = ["**/.*", "**/.*/**", "**/_drafts/**", "**/*.meta.json", "**/*.meta.yaml", "**/*.meta.yml",
                   "**/manifest.jsonl", "**/manifest.csv", "**/_manifest.jsonl"]


class SourceSpec(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,62}$")
    name: str
    uri: str
    enabled: bool = True
    origin: str = "config"
    include: list[str] = Field(default_factory=lambda: list(DEFAULT_INCLUDE))
    exclude: list[str] = Field(default_factory=lambda: list(DEFAULT_EXCLUDE))
    storage_options: dict[str, Any] = Field(default_factory=dict)
    defaults: dict[str, Any] = Field(default_factory=dict)

    @field_validator("uri")
    @classmethod
    def _uri(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("uri must not be empty")
        return value.strip()

    def parsed(self, settings: Settings) -> ParsedURI:
        return parse_source_uri(self.uri, settings.project_root)

    def resolved_storage_options(self) -> dict[str, Any]:
        return drop_empty(interpolate_env(self.storage_options))


def load_config_sources(settings: Settings) -> list[SourceSpec]:
    specs: list[SourceSpec] = []
    path = settings.data_sources_file
    global_include, global_exclude = list(DEFAULT_INCLUDE), list(DEFAULT_EXCLUDE)
    if path and path.exists():
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        defaults = raw.get("defaults") or {}
        global_include = defaults.get("include") or global_include
        global_exclude = defaults.get("exclude") or global_exclude
        for item in raw.get("sources") or []:
            try:
                specs.append(
                    SourceSpec(
                        id=item["id"],
                        name=item.get("name") or item["id"],
                        uri=item["uri"],
                        enabled=bool(item.get("enabled", True)),
                        origin="config",
                        include=item.get("include") or global_include,
                        exclude=item.get("exclude") or global_exclude,
                        storage_options=item.get("storage_options") or {},
                        defaults=item.get("defaults") or {},
                    )
                )
            except Exception as exc:  # invalid entry must not take the platform down
                log.error("invalid data source entry in %s: %s (%s)", path, item, exc)
    elif path:
        log.warning("data source registry %s not found — only env/API sources will be used", path)

    if settings.data_source_uri:
        uri = settings.data_source_uri
        specs.append(
            SourceSpec(
                id=f"env-{slugify(uri, 40)}"[:63],
                name="DATA_SOURCE_URI",
                uri=uri,
                origin="env",
                include=global_include,
                exclude=global_exclude,
                defaults={"source_type": "auto", "credibility": "unverified"},
            )
        )
    return specs


def spec_from_row(row: DataSourceRow) -> SourceSpec:
    return SourceSpec(
        id=row.id,
        name=row.name,
        uri=row.uri,
        enabled=row.enabled,
        origin=row.origin,
        include=row.include or list(DEFAULT_INCLUDE),
        exclude=row.exclude or list(DEFAULT_EXCLUDE),
        storage_options=row.storage_options or {},
        defaults=row.defaults or {},
    )


class SourceRegistry:
    def __init__(self, settings: Settings, db: Database) -> None:
        self.settings = settings
        self.db = db

    def sync_config(self) -> list[SourceSpec]:
        """Upsert config/env sources into the DB. API-created sources are left untouched."""
        specs = load_config_sources(self.settings)
        wanted = {s.id: s for s in specs}
        with self.db.session() as session:
            rows = {r.id: r for r in session.scalars(select(DataSourceRow))}
            for spec in specs:
                row = rows.get(spec.id)
                if row is None:
                    row = DataSourceRow(id=spec.id)
                    session.add(row)
                elif row.origin == "api":
                    log.warning("config source id %s collides with an API source — config ignored", spec.id)
                    continue
                row.name, row.uri, row.enabled, row.origin = spec.name, spec.uri, spec.enabled, spec.origin
                row.include, row.exclude = spec.include, spec.exclude
                row.storage_options, row.defaults = spec.storage_options, spec.defaults
            for row in rows.values():
                if row.origin in ("config", "env") and row.id not in wanted:
                    session.delete(row)  # documents become orphans and are purged by the next sync
        return self.list()

    def list(self, *, enabled_only: bool = False) -> list[SourceSpec]:
        with self.db.session() as session:
            stmt = select(DataSourceRow).order_by(DataSourceRow.created_at)
            if enabled_only:
                stmt = stmt.where(DataSourceRow.enabled.is_(True))
            return [spec_from_row(r) for r in session.scalars(stmt)]

    def get(self, source_id: str) -> SourceSpec | None:
        with self.db.session() as session:
            row = session.get(DataSourceRow, source_id)
            return spec_from_row(row) if row else None

    def create(self, spec: SourceSpec) -> SourceSpec:
        self.validate(spec)
        with self.db.session() as session:
            if session.get(DataSourceRow, spec.id):
                raise ValueError(f"a source with id '{spec.id}' already exists")
            session.add(
                DataSourceRow(
                    id=spec.id, name=spec.name, uri=spec.uri, enabled=spec.enabled, origin="api",
                    include=spec.include, exclude=spec.exclude, storage_options=spec.storage_options,
                    defaults=spec.defaults,
                )
            )
        return spec.model_copy(update={"origin": "api"})

    def update(self, source_id: str, changes: dict[str, Any]) -> SourceSpec:
        with self.db.session() as session:
            row = session.get(DataSourceRow, source_id)
            if row is None:
                raise KeyError(source_id)
            if row.origin != "api" and set(changes) - {"enabled"}:
                raise ValueError("sources defined in sources.yaml can only be enabled/disabled via the API")
            for key, value in changes.items():
                if value is not None and hasattr(row, key):
                    setattr(row, key, value)
            spec = spec_from_row(row)
        self.validate(spec)
        return spec

    def delete(self, source_id: str) -> None:
        with self.db.session() as session:
            row = session.get(DataSourceRow, source_id)
            if row is None:
                raise KeyError(source_id)
            if row.origin != "api":
                raise ValueError("sources defined in sources.yaml must be removed from the file")
            session.delete(row)

    def validate(self, spec: SourceSpec) -> None:
        parsed = spec.parsed(self.settings)
        extra = EXTRA_FOR_PROTOCOL.get(parsed.protocol)
        if extra:
            import fsspec

            try:
                fsspec.get_filesystem_class(parsed.protocol)
            except (ImportError, ValueError) as exc:
                raise ValueError(
                    f"{parsed.kind} support is not installed — run: pip install 'cancer-insights-backend[{extra}]'"
                ) from exc
