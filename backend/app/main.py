"""FastAPI application factory."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.api.routes import admin, community, public, sync
from app.container import Container, get_container, set_container
from app.core.logging import configure_logging, request_id_var
from app.core.metrics import HTTP_LATENCY, HTTP_REQUESTS
from app.settings import Settings, get_settings
from app.workers.scheduler import SyncScheduler

log = logging.getLogger("app")


def create_app(settings: Settings | None = None, container: Container | None = None) -> FastAPI:
    settings = settings or (container.settings if container else get_settings())
    configure_logging(settings.log_level, settings.log_json)
    owns_container = container is None  # an injected container (tests, embedding apps) is closed by its owner
    if container is not None:
        set_container(container)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        c = get_container()
        c.db  # noqa: B018 - create tables / connect before serving
        c.registry.sync_config()
        c.store.ensure(c.embedder.dim)
        c.jobs.recover_stale()
        c.refresh_gauges()
        scheduler = None
        if settings.run_scheduler and settings.queue_backend == "inline" and settings.environment != "test":
            scheduler = SyncScheduler(c)
            scheduler.start()
        log.info("%s %s ready (env=%s, llm=%s, store=%s, embeddings=%s)", settings.app_name, settings.version,
                 settings.environment, settings.llm_provider, settings.vector_store, settings.embedding_provider)
        yield
        if scheduler:
            scheduler.stop()
        if owns_container:
            if c.llm is not None:
                await c.llm.aclose()
            if c.llm_canary is not None:
                await c.llm_canary.aclose()
            c.close()

    app = FastAPI(
        title=f"{settings.app_name} API",
        version=settings.version,
        description="Evidence-grounded, multilingual answers and insights on lifestyle, cancer prevention and "
                    "living well with cancer. Every claim is cited, verified and graded.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Admin-Key", "X-Member-Token", "X-Country", "X-Request-ID",
                       "Accept-Language", "If-None-Match"],
        expose_headers=["X-Request-ID", "ETag", "Retry-After", "X-Sync-Version"],
        max_age=600,
    )

    @app.middleware("http")
    async def observability(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        token = request_id_var.set(rid[:64])
        start = time.perf_counter()
        route = "unmatched"
        try:
            response = await call_next(request)
            route = getattr(request.scope.get("route"), "path", route)
        finally:
            request_id_var.reset(token)
        elapsed = time.perf_counter() - start
        HTTP_REQUESTS.labels(request.method, route, str(response.status_code)).inc()
        HTTP_LATENCY.labels(request.method, route).observe(elapsed)
        response.headers["X-Request-ID"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        if "/community" in request.url.path:  # people's health stories: never cached, never indexed
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse({"error": {"code": exc.status_code, "message": exc.detail,
                                       "request_id": request_id_var.get()}},
                            status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # never echo `input` back (it may contain personal health text); stringify exception contexts
        details = [{"loc": e.get("loc"), "msg": e.get("msg"), "type": e.get("type")} for e in exc.errors()[:20]]
        return JSONResponse({"error": {"code": 422, "message": "invalid request", "details": jsonable_encoder(details),
                                       "request_id": request_id_var.get()}}, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"error": {"code": 500, "message": "internal error", "request_id": request_id_var.get()}},
                            status_code=500)

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict:
        return {"ok": True}

    @app.get("/readyz", include_in_schema=False)
    def readyz() -> JSONResponse:
        c = get_container()
        checks = {"database": False, "vector_store": False}
        try:
            checks["database"] = c.db.ping()
            checks["vector_store"] = c.store.health()
        except Exception as exc:
            log.warning("readiness check failed: %s", exc)
        ok = all(checks.values())
        return JSONResponse({"ok": ok, "checks": checks}, status_code=200 if ok else 503)

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> PlainTextResponse:
        return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    app.include_router(public.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)
    app.include_router(community.router, prefix=settings.api_prefix)
    app.include_router(community.admin_router, prefix=settings.api_prefix)
    app.include_router(sync.router, prefix=settings.api_prefix)
    return app


def app_factory() -> FastAPI:  # uvicorn --factory app.main:app_factory
    return create_app()
