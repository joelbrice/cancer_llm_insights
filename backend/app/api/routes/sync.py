"""Optional end-to-end-encrypted device sync (opaque ciphertext; see app/services/device_sync.py)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.api.deps import RateLimiter, client_key, container_dep, rate_limit
from app.container import Container
from app.services.device_sync import DeviceSyncService, SyncError

router = APIRouter(prefix="/sync", tags=["sync"], dependencies=[Depends(rate_limit("api"))])
_writes = RateLimiter()
NO_STORE = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex"}


class SyncPut(BaseModel):
    ciphertext: str = Field(min_length=32, max_length=2_000_000)
    version: int = Field(ge=0, description="The version this write is based on (0 to create)")


class SyncBlob(BaseModel):
    ciphertext: str
    version: int
    updated_at: str


class SyncMeta(BaseModel):
    enabled: bool
    max_bytes: int


def _service(c: Container = Depends(container_dep)) -> DeviceSyncService:
    if not c.settings.device_sync_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sync disabled")
    return c.device_sync


def _bearer(authorization: str | None) -> str | None:
    return authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None


def _fail(exc: SyncError) -> HTTPException:
    headers = dict(NO_STORE)
    if exc.current_version is not None:
        headers["X-Sync-Version"] = str(exc.current_version)
    return HTTPException(exc.status, exc.code, headers=headers)


@router.get("", response_model=SyncMeta)
def meta(c: Container = Depends(container_dep)) -> SyncMeta:
    return SyncMeta(enabled=c.settings.device_sync_enabled, max_bytes=c.settings.device_sync_max_bytes)


@router.get("/{sync_id}", response_model=SyncBlob)
def get_blob(sync_id: str, response: Response, authorization: str | None = Header(default=None),
             svc: DeviceSyncService = Depends(_service)) -> SyncBlob:
    try:
        row = svc.get(sync_id, _bearer(authorization))
    except SyncError as exc:
        raise _fail(exc) from exc
    response.headers.update(NO_STORE)
    return SyncBlob(ciphertext=row.ciphertext, version=row.version, updated_at=row.updated_at.isoformat())


@router.put("/{sync_id}", response_model=SyncBlob)
def put_blob(sync_id: str, body: SyncPut, request: Request, response: Response,
             authorization: str | None = Header(default=None), svc: DeviceSyncService = Depends(_service),
             c: Container = Depends(container_dep)) -> SyncBlob:
    client = client_key(request, c.settings.trust_forwarded_for, c.settings.forwarded_for_hops)
    allowed, retry = _writes.allow(f"sync:{sync_id[:64]}:{client}", c.settings.device_sync_writes_per_minute)
    if not allowed:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "slow_down", headers={"Retry-After": str(retry)})
    try:
        row = svc.put(sync_id, _bearer(authorization), body.ciphertext, body.version)
    except SyncError as exc:
        raise _fail(exc) from exc
    response.headers.update(NO_STORE)
    return SyncBlob(ciphertext="", version=row.version, updated_at=row.updated_at.isoformat())


@router.delete("/{sync_id}", status_code=204)
def delete_blob(sync_id: str, authorization: str | None = Header(default=None),
                svc: DeviceSyncService = Depends(_service)) -> Response:
    try:
        svc.delete(sync_id, _bearer(authorization))
    except SyncError as exc:
        raise _fail(exc) from exc
    return Response(status_code=204, headers=NO_STORE)
