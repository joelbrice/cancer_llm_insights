"""LLM providers.

The fine-tuned LLaMA is served by any OpenAI-compatible server — vLLM (recommended, supports LoRA adapters,
continuous batching and guided JSON decoding), Hugging Face TGI, Ollama, llama.cpp-server or LM Studio.
When no LLM is configured (`LLM_PROVIDER=extractive`) the platform still answers, using the extractive
composer: verbatim, cited source sentences — no generation, zero hallucination risk.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.settings import Settings

log = logging.getLogger(__name__)


@dataclass(slots=True)
class Message:
    role: str  # system | user | assistant
    content: str


class LLMError(RuntimeError):
    pass


class LLMProvider(ABC):
    name: str
    model: str

    @abstractmethod
    def stream(self, messages: list[Message], *, max_tokens: int | None = None,
               temperature: float | None = None) -> AsyncIterator[str]: ...

    async def complete(self, messages: list[Message], *, max_tokens: int | None = None,
                       temperature: float | None = None, json_schema: dict[str, Any] | None = None) -> str:
        parts = [part async for part in self.stream(messages, max_tokens=max_tokens, temperature=temperature)]
        return "".join(parts)

    async def health(self) -> bool:
        return True

    async def aclose(self) -> None:  # noqa: B027
        pass


class OpenAICompatibleProvider(LLMProvider):
    name = "openai_compatible"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model = settings.llm_model
        headers = {"Content-Type": "application/json"}
        if settings.llm_api_key:
            headers["Authorization"] = f"Bearer {settings.llm_api_key.get_secret_value()}"
        self._client = httpx.AsyncClient(
            base_url=settings.llm_base_url.rstrip("/"), headers=headers,
            timeout=httpx.Timeout(settings.llm_timeout_seconds, connect=10.0),
            limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
        )
        self._json_mode: str | None = None  # learned: "json_schema" | "json_object" | "none"

    def _payload(self, messages: list[Message], max_tokens: int | None, temperature: float | None,
                 stream: bool) -> dict[str, Any]:
        return {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens or self.settings.llm_max_tokens,
            "temperature": self.settings.llm_temperature if temperature is None else temperature,
            "top_p": self.settings.llm_top_p,
            "stream": stream,
        }

    async def stream(self, messages: list[Message], *, max_tokens: int | None = None,
                     temperature: float | None = None) -> AsyncIterator[str]:
        payload = self._payload(messages, max_tokens, temperature, stream=True)
        attempt, delay = 0, 1.0
        while True:
            emitted = False
            try:
                async with self._client.stream("POST", "/chat/completions", json=payload) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode("utf-8", "replace")[:500]
                        raise httpx.HTTPStatusError(f"LLM HTTP {response.status_code}: {body}",
                                                    request=response.request, response=response)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            return
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}
                        text = delta.get("content")
                        if text:
                            emitted = True
                            yield text
                    return
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
                retriable = status is None or status >= 500 or status == 429
                if emitted or not retriable or attempt >= self.settings.llm_max_retries:
                    raise LLMError(str(exc)) from exc
                attempt += 1
                log.warning("LLM request failed (%s); retry %d in %.1fs", exc, attempt, delay)
                await asyncio.sleep(delay)
                delay *= 2

    async def complete(self, messages: list[Message], *, max_tokens: int | None = None,
                       temperature: float | None = None, json_schema: dict[str, Any] | None = None) -> str:
        payload = self._payload(messages, max_tokens, temperature, stream=False)
        modes = [self._json_mode] if self._json_mode else ["json_schema", "json_object", "none"]
        if json_schema is None:
            modes = ["none"]
        last_error: Exception | None = None
        for mode in modes:
            body = dict(payload)
            if mode == "json_schema":
                body["response_format"] = {"type": "json_schema",
                                           "json_schema": {"name": "insight", "schema": json_schema, "strict": True}}
            elif mode == "json_object":
                body["response_format"] = {"type": "json_object"}
            try:
                response = await self._client.post("/chat/completions", json=body)
                if response.status_code == 400 and mode != "none":
                    last_error = LLMError(response.text[:300])
                    continue  # server does not support this response_format: degrade
                response.raise_for_status()
                if json_schema is not None:
                    self._json_mode = mode
                return response.json()["choices"][0]["message"]["content"] or ""
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last_error = exc
                break
        raise LLMError(f"LLM completion failed: {last_error}")

    async def health(self) -> bool:
        try:
            response = await self._client.get("/models", timeout=5.0)
            return response.status_code < 500
        except httpx.HTTPError:
            return False

    async def aclose(self) -> None:
        await self._client.aclose()


def parse_json_object(text: str) -> dict[str, Any]:
    """Robustly extract the first JSON object from model output (handles ```json fences and preambles)."""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass
    depth, start = 0, None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    value = json.loads(text[start: i + 1])
                    if isinstance(value, dict):
                        return value
                except json.JSONDecodeError:
                    start = None
    raise LLMError("model did not return a JSON object")


def build_llm(settings: Settings) -> LLMProvider | None:
    if settings.llm_provider == "openai_compatible":
        return OpenAICompatibleProvider(settings)
    return None
