"""Request dependencies: container access, admin authentication, rate limiting, language resolution."""

from __future__ import annotations

import hmac
import threading
import time
from collections import OrderedDict

from fastapi import Depends, Header, HTTPException, Request, status

from app.container import Container, get_container


def container_dep() -> Container:
    return get_container()


def require_admin(
    request: Request,
    x_admin_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    container: Container = Depends(container_dep),
) -> None:
    expected = container.settings.admin_api_key
    if expected is None:
        if container.settings.environment in ("production", "staging"):
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "admin API disabled: ADMIN_API_KEY not set")
        return  # development: open, flagged in /status (admin_protected=false)
    supplied = x_admin_key or (authorization[7:] if authorization and authorization.lower().startswith("bearer ")
                               else None)
    if not supplied or not hmac.compare_digest(supplied.encode(), expected.get_secret_value().encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or missing admin key",
                            headers={"WWW-Authenticate": "Bearer"})


class RateLimiter:
    """Token bucket per client and bucket name. In-memory by default; Redis when REDIS_URL is configured so
    limits hold across API replicas."""

    def __init__(self, redis_url: str | None = None, max_keys: int = 50_000) -> None:
        self._lock = threading.Lock()
        self._buckets: OrderedDict[str, tuple[float, float]] = OrderedDict()
        self._max_keys = max_keys
        self._redis = None
        if redis_url:
            try:
                from redis import Redis

                self._redis = Redis.from_url(redis_url, socket_timeout=0.2)
            except Exception:
                self._redis = None

    def allow(self, key: str, per_minute: int) -> tuple[bool, int]:
        if per_minute <= 0:
            return True, 0
        if self._redis is not None:
            try:
                window = int(time.time() // 60)
                rkey = f"rl:{key}:{window}"
                count = self._redis.incr(rkey)
                if count == 1:
                    self._redis.expire(rkey, 70)
                return count <= per_minute, 60 - int(time.time() % 60)
            except Exception:
                pass  # degrade to local limiter
        now = time.monotonic()
        rate = per_minute / 60.0
        with self._lock:
            tokens, last = self._buckets.pop(key, (float(per_minute), now))
            tokens = min(float(per_minute), tokens + (now - last) * rate)
            allowed = tokens >= 1.0
            if allowed:
                tokens -= 1.0
            self._buckets[key] = (tokens, now)
            if len(self._buckets) > self._max_keys:
                self._buckets.popitem(last=False)
        retry = 0 if allowed else int((1.0 - tokens) / rate) + 1
        return allowed, retry


_limiter: RateLimiter | None = None


def client_key(request: Request, trust_forwarded: bool) -> str:
    if trust_forwarded:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(bucket: str):
    def dependency(request: Request, container: Container = Depends(container_dep)) -> None:
        global _limiter
        if _limiter is None:
            _limiter = RateLimiter(container.settings.redis_url)
        s = container.settings
        limit = s.chat_rate_limit_per_minute if bucket == "chat" else s.rate_limit_per_minute
        allowed, retry = _limiter.allow(f"{bucket}:{client_key(request, s.trust_forwarded_for)}", limit)
        if not allowed:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "rate limit exceeded",
                                headers={"Retry-After": str(retry)})

    return dependency


def resolve_language(lang: str | None, container: Container) -> str:
    code = (lang or "").split("-")[0].lower()
    return code if code in container.settings.supported_languages else container.settings.default_language
