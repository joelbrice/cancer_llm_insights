"""End-to-end-encrypted sync of a person's plan and profile across their devices (optional, docs/BUILD_SPEC.md §15).

The device creates a random sync code and derives three values from it with HKDF-SHA256
(packages/shared/src/sync.ts):

* `id`   — where the blob lives (64 hex characters);
* `auth` — a write secret, sent as a bearer token; the server keeps only its SHA-256;
* `key`  — the XChaCha20-Poly1305 key. It never leaves the device.

The server stores ciphertext it cannot read, with a version number for optimistic concurrency (a stale write gets
409 and the device merges and retries). There is no account, email or device identifier. Losing the code means
losing access — by design.
"""

from __future__ import annotations

import hashlib
import hmac
import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete

from app.db.base import Database
from app.db.models import SyncBlobRow
from app.settings import Settings

SYNC_ID = re.compile(r"^[0-9a-f]{64}$")
AUTH = re.compile(r"^[A-Za-z0-9_-]{43}$")  # 32 bytes, base64url without padding
CIPHERTEXT = re.compile(r"^[A-Za-z0-9_-]+$")


class SyncError(Exception):
    def __init__(self, status: int, code: str, current_version: int | None = None) -> None:
        super().__init__(code)
        self.status, self.code, self.current_version = status, code, current_version


def _digest(auth: str) -> str:
    return hashlib.sha256(auth.encode()).hexdigest()


class DeviceSyncService:
    def __init__(self, settings: Settings, db: Database) -> None:
        self.settings = settings
        self.db = db

    def _check(self, sync_id: str, auth: str | None) -> str:
        if not SYNC_ID.match(sync_id):
            raise SyncError(404, "not_found")
        if not auth or not AUTH.match(auth):
            raise SyncError(401, "sync_auth_required")
        return _digest(auth)

    def get(self, sync_id: str, auth: str | None) -> SyncBlobRow:
        digest = self._check(sync_id, auth)
        with self.db.session() as session:
            row = session.get(SyncBlobRow, sync_id)
            if row is None or not hmac.compare_digest(row.auth_hash, digest):
                raise SyncError(404, "not_found")  # same answer either way: no existence oracle
            return row

    def put(self, sync_id: str, auth: str | None, ciphertext: str, expected_version: int) -> SyncBlobRow:
        digest = self._check(sync_id, auth)
        if not CIPHERTEXT.match(ciphertext) or len(ciphertext) < 32:
            raise SyncError(422, "invalid_ciphertext")
        size = len(ciphertext) * 3 // 4
        if size > self.settings.device_sync_max_bytes:
            raise SyncError(413, "too_large")
        now = datetime.now(UTC)
        with self.db.session() as session:
            row = session.get(SyncBlobRow, sync_id)
            if row is None:
                if expected_version != 0:
                    raise SyncError(409, "version_conflict", current_version=0)
                row = SyncBlobRow(id=sync_id, auth_hash=digest, ciphertext=ciphertext, version=1, size=size,
                                  created_at=now, updated_at=now)
                session.add(row)
                return row
            if not hmac.compare_digest(row.auth_hash, digest):
                raise SyncError(404, "not_found")
            if row.version != expected_version:
                raise SyncError(409, "version_conflict", current_version=row.version)
            row.ciphertext, row.size, row.version, row.updated_at = ciphertext, size, row.version + 1, now
            return row

    def delete(self, sync_id: str, auth: str | None) -> None:
        digest = self._check(sync_id, auth)
        with self.db.session() as session:
            row = session.get(SyncBlobRow, sync_id)
            if row is None or not hmac.compare_digest(row.auth_hash, digest):
                raise SyncError(404, "not_found")
            session.delete(row)

    def purge(self, now: datetime | None = None) -> int:
        cutoff = (now or datetime.now(UTC)) - timedelta(days=self.settings.device_sync_retention_days)
        with self.db.session() as session:
            return int(session.execute(delete(SyncBlobRow).where(SyncBlobRow.updated_at < cutoff)).rowcount or 0)
