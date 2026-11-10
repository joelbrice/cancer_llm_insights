"""Reject request bodies above a size limit before they are read into memory (the ingress applies the same limit
in Kubernetes; this covers Compose and direct access)."""

from __future__ import annotations

import json

from fastapi import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class _TooLarge(HTTPException):
    """An HTTPException, so FastAPI's body parsing passes it on as a 413 instead of turning it into a 400."""

    def __init__(self) -> None:
        super().__init__(413, "request body too large")


def _response(limit: int) -> tuple[dict, bytes]:
    body = json.dumps({"error": {"code": 413, "message": "request body too large", "limit_bytes": limit}}).encode()
    start = {"type": "http.response.start", "status": 413,
             "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                         (b"connection", b"close")]}
    return start, body


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.max_bytes <= 0:
            await self.app(scope, receive, send)
            return
        start, body = _response(self.max_bytes)
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    too_large = int(value) > self.max_bytes
                except ValueError:
                    too_large = False
                if too_large:
                    await send(start)
                    await send({"type": "http.response.body", "body": body})
                    return

        received = 0
        started = False

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _TooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except _TooLarge:
            if not started:  # chunked upload without Content-Length that grew past the limit
                await send(start)
                await send({"type": "http.response.body", "body": body})
