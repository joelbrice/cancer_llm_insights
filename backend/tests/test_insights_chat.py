import asyncio
import json

import httpx
import pytest

from app.llm.providers import LLMError, OpenAICompatibleProvider, parse_json_object
from app.schemas.api import ChatMessage, ChatRequest, Profile


def ask(container, text: str, **kwargs):
    return asyncio.run(container.chat.answer(ChatRequest(messages=[ChatMessage(role="user", content=text)],
                                                         stream=False, **kwargs)))


# ── insights (session-built platform) ────────────────────────────────────────
def test_insights_only_published_with_enough_on_topic_evidence(built):
    statuses = {t.id: t.status for t in built.insights.topic_statuses("en")}
    assert statuses["physical-activity-prevention"] == "published"
    assert statuses["alcohol-risk"] == "published"
    assert statuses["quitting-smoking"] == "published"
    for off_topic in ("hpv-vaccination", "radon-air-pollution", "screening-programmes", "h-pylori"):
        assert statuses[off_topic] == "insufficient_evidence", off_topic


def test_every_published_insight_is_fully_evidenced(built):
    for lang in ("en", "fr"):
        listing = built.insights.list(language=lang, page_size=100)
        assert listing.total >= 3
        for summary in listing.items:
            insight = built.insights.get(summary.id)
            assert insight.evidence.n_sources >= built.settings.insight_min_sources
            assert insight.key_points
            cited_ns = {c.n for c in insight.citations}
            assert cited_ns == set(range(1, len(insight.citations) + 1))  # compact numbering
            for point in insight.key_points + insight.recommendations:
                assert point.citations and set(point.citations) <= cited_ns
                assert point.label in ("supported", "partial")
            for c in insight.citations:
                assert c.quote and c.quote in c.passage
                assert c.passage[c.quote_start:c.quote_end] == c.quote
            assert insight.evidence.rationale


def test_insight_rebuild_is_idempotent(built):
    result = built.insights.build_all(["physical-activity-prevention"], ["en"])
    assert result.unchanged == 1 and result.built == 0


def test_related_insights(built):
    related = built.insights.related("How much exercise lowers colon cancer risk?", "en")
    assert related and related[0].id.endswith(".en")


# ── chat ─────────────────────────────────────────────────────────────────────
def test_grounded_extractive_answer(built):
    r = ask(built, "Does physical activity lower the risk of colon cancer?")
    assert not r.abstained and r.citations
    assert r.verification.grounded_ratio == 1.0
    assert r.evidence.level in ("high", "moderate")
    assert "[1]" in r.answer and r.disclaimer


def test_chat_abstains_without_relevant_evidence(built):
    r = ask(built, "Is radon at home a cause of lung cancer?")
    assert r.abstained and r.abstain_reason == "insufficient_evidence" and not r.citations


def test_chat_language_detection_and_french_answer(built):
    r = ask(built, "La viande transformée augmente-t-elle le risque de cancer colorectal ?")
    assert r.language == "fr" and r.answer.startswith("Voici")


def test_emergency_blocks_generation(built):
    r = ask(built, "I have crushing chest pain and can't breathe", profile=Profile(country="US"))
    assert r.abstained and r.abstain_reason == "safety" and r.safety.level == "emergency"
    assert "emergency" in r.answer.lower()
    r = ask(built, "I want to end my life", profile=Profile(country="US"))
    assert any("988" in res.contact for res in r.safety.resources)


def test_urgent_notice_travels_with_answer(built):
    r = ask(built, "I'm on chemotherapy with a fever, is exercise still safe during chemotherapy?")
    assert r.safety.level == "urgent" and not r.safety.block_generation


def test_follow_up_question_uses_history(built):
    history = [ChatMessage(role="user", content="How does alcohol affect breast cancer risk?"),
               ChatMessage(role="assistant", content="Alcohol raises breast cancer risk [1]."),
               ChatMessage(role="user", content="And what about wine?")]
    r = asyncio.run(built.chat.answer(ChatRequest(messages=history, stream=False)))
    assert not r.abstained and any("lcohol" in c.source.title for c in r.citations)


# ── LLM provider (OpenAI-compatible: vLLM / TGI / Ollama / llama.cpp) ────────
class FakeLLM:
    """A scripted LLM used to test the generation path end-to-end."""

    name, model = "fake", "fake-llama"

    def __init__(self, reply: str, fail: bool = False) -> None:
        self.reply, self.fail = reply, fail

    async def stream(self, messages, **kwargs):
        if self.fail:
            raise LLMError("server down")
        for word in self.reply.split(" "):
            yield word + " "

    async def complete(self, messages, **kwargs):
        if self.fail:
            raise LLMError("server down")
        return self.reply

    async def health(self):
        return not self.fail

    async def aclose(self):
        pass


def test_llm_answer_is_verified_and_unsupported_claims_flagged(built):
    chat = built.chat
    original = chat.llm
    try:
        chat.llm = FakeLLM("Higher levels of physical activity were associated with a lower risk of colon cancer [1]. "
                           "Physical activity cures cancer in 100% of people [1].")
        r = ask(built, "Does physical activity lower the risk of colon cancer?")
        labels = [c.label for c in r.verification.claims]
        assert labels[0] == "supported" and labels[1] == "unsupported"
        assert r.output_flags == ["absolute_claim"]
        assert r.model == "fake-llama"
        chat.llm = FakeLLM("", fail=True)
        r = ask(built, "Does physical activity lower the risk of colon cancer?")
        assert r.model == "extractive" and not r.abstained  # graceful fallback
    finally:
        chat.llm = original


def test_openai_compatible_streaming_and_json_mode_fallback(settings):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        calls.append(body)
        if body.get("stream"):
            chunks = [{"choices": [{"delta": {"content": "Hello "}}]}, {"choices": [{"delta": {"content": "[1]."}}]}]
            payload = "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
            return httpx.Response(200, text=payload, headers={"content-type": "text/event-stream"})
        if body.get("response_format", {}).get("type") == "json_schema":
            return httpx.Response(400, json={"error": "unsupported response_format"})
        return httpx.Response(200, json={"choices": [{"message": {"content": '```json\n{"a": 1}\n```'}}]})

    provider = OpenAICompatibleProvider(settings)
    provider._client = httpx.AsyncClient(base_url="http://llm/v1", transport=httpx.MockTransport(handler))

    async def run():
        text = "".join([p async for p in provider.stream([])])
        raw = await provider.complete([], json_schema={"type": "object"})
        return text, raw

    text, raw = asyncio.run(run())
    assert text == "Hello [1]."
    assert parse_json_object(raw) == {"a": 1}
    assert [c.get("response_format", {}).get("type") for c in calls[1:]] == ["json_schema", "json_object"]
    assert provider._json_mode == "json_object"


def test_parse_json_object_recovers_from_preamble():
    assert parse_json_object('Sure! Here it is: {"x": {"y": 2}} trailing') == {"x": {"y": 2}}
    with pytest.raises(LLMError):
        parse_json_object("no json here")
