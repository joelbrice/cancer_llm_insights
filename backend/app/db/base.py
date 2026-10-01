"""Engine/session management. SQLite for development, PostgreSQL for production."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import JSON, create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

JSONType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    type_annotation_map = {dict: JSONType, list: JSONType}


class Database:
    def __init__(self, url: str, *, echo: bool = False, pool_size: int = 10) -> None:
        self.url = url
        kwargs: dict = {"echo": echo, "future": True}
        if url.startswith("sqlite"):
            path = url.split("///", 1)[-1]
            if path and path != ":memory:":
                Path(path).parent.mkdir(parents=True, exist_ok=True)
            kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
        else:
            kwargs.update(pool_size=pool_size, max_overflow=pool_size * 2, pool_pre_ping=True, pool_recycle=1800)
        self.engine: Engine = create_engine(url, **kwargs)
        if url.startswith("sqlite"):
            event.listen(self.engine, "connect", _sqlite_pragmas)
        self._sessionmaker = sessionmaker(self.engine, expire_on_commit=False, autoflush=False)

    def create_all(self) -> None:
        from app.db import models  # noqa: F401  (register models)

        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self._sessionmaker()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def ping(self) -> bool:
        from sqlalchemy import text

        with self.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True

    def dispose(self) -> None:
        self.engine.dispose()


def _sqlite_pragmas(dbapi_conn, _record) -> None:  # pragma: no cover - driver hook
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()
