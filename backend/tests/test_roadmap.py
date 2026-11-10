"""Roadmap features (docs/BUILD_SPEC.md §9.4–9.5, §15): appeals, transparency report, "I felt supported",
clinical review of insights, model canary and end-to-end-encrypted device sync. Every one is additive or
opt-in: the defaults keep the 1.0 behaviour (covered by the rest of the suite)."""

from __future__ import annotations

import base64
import hashlib
import os
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.container import Container, set_container
from app.main import create_app
from tests.conftest import make_settings
from tests.test_community import API, join, post

ADMIN = "/api/v1/admin/community"


@contextmanager
def app_with(tmp_path, corpus, **overrides):
    settings = make_settings(tmp_path, corpus, **overrides)
    container = Container(settings)
    set_container(container)
    with TestClient(create_app(settings, container)) as client:
        yield client, container
    container.close()
    set_container(None)


def remove(client, post_id: str) -> None:
    assert client.post(f"{ADMIN}/posts/{post_id}/moderate", json={"action": "remove"}).status_code == 200


# ── appeals ──────────────────────────────────────────────────────────────────────────────────────────────────
def test_authors_see_why_and_can_appeal_once(client):
    ana, ben = join(client, "Appeal Ana"), join(client, "Other Ben")
    pid = post(client, ana, "A perfectly kind message about my walk today").json()["post"]["id"]
    assert client.get(f"{API}/members/me/moderation", headers=ana).json() == []  # nothing held or removed
    remove(client, pid)

    mine = client.get(f"{API}/members/me/moderation", headers=ana).json()
    assert [(m["post"]["id"], m["decision"], m["can_appeal"], m["appeal"]) for m in mine] == [
        (pid, "remove", True, None)]
    assert mine[0]["post"]["status"] == "removed" and mine[0]["decided_at"]

    text = "I think this was a mistake, it was only about walking."
    assert client.post(f"{API}/posts/{pid}/appeal", json={"text": text}, headers=ben).status_code == 404  # not yours
    assert client.post(f"{API}/posts/{pid}/appeal", json={"text": "short"}, headers=ana).status_code == 422
    assert client.post(f"{API}/posts/{pid}/appeal", json={"text": "Mistake, write me at ana@example.com please"},
                       headers=ana).json()["error"]["message"] == "contact_details"
    r = client.post(f"{API}/posts/{pid}/appeal", json={"text": text}, headers=ana)
    assert r.status_code == 201 and r.json()["appeal"]["status"] == "open" and r.json()["safety"] is None
    assert client.post(f"{API}/posts/{pid}/appeal", json={"text": text}, headers=ana).status_code == 409
    assert client.get(f"{API}/members/me/moderation", headers=ana).json()[0]["can_appeal"] is False

    queue = client.get(f"{ADMIN}/appeals").json()
    assert [(q["appeal"]["post_id"], q["post"]["body"]) for q in queue] == [(pid, "A perfectly kind message about my walk today")]
    decided = client.post(f"{ADMIN}/appeals/{queue[0]['appeal']['id']}",
                          json={"action": "overturn", "response": "You're right, sorry. It's back."})
    assert decided.status_code == 200 and decided.json()["status"] == "overturned"
    assert client.post(f"{ADMIN}/appeals/{queue[0]['appeal']['id']}", json={"action": "uphold"}).status_code == 409
    assert pid in [p["id"] for p in client.get(f"{API}/posts", headers=ben).json()["items"]]  # published again
    assert client.get(f"{API}/members/me/moderation", headers=ana).json() == []
    assert client.get(f"{ADMIN}/appeals").json() == []
    assert len(client.get(f"{ADMIN}/appeals", params={"status": "overturned"}).json()) == 1
    exported = client.get(f"{API}/members/me/export", headers=ana).json()
    assert exported["appeals"][0]["response"] == "You're right, sorry. It's back."


def test_upheld_appeal_on_a_held_post_removes_it(client):
    ana = join(client, "Held Appeal")
    held = post(client, ana, "DM me for a discount code on my shop's supplements").json()
    assert held["moderation"]["status"] == "held"
    pid = held["post"]["id"]
    item = client.get(f"{API}/members/me/moderation", headers=ana).json()[0]
    assert (item["reason"], item["decision"], item["can_appeal"]) == ("solicitation", None, True)
    appeal = client.post(f"{API}/posts/{pid}/appeal", json={"text": "I was only sharing what helped me."},
                         headers=ana).json()["appeal"]
    queue_item = next(q for q in client.get(f"{ADMIN}/queue").json() if q["post"]["id"] == pid)
    assert queue_item["appeal"]["id"] == appeal["id"]  # moderators see the appeal next to the held post
    client.post(f"{ADMIN}/appeals/{appeal['id']}", json={"action": "uphold", "response": "Selling isn't allowed."})
    item = client.get(f"{API}/members/me/moderation", headers=ana).json()[0]
    assert item["post"]["status"] == "removed" and item["appeal"]["status"] == "upheld"
    assert item["appeal"]["response"] == "Selling isn't allowed."


def test_crisis_in_an_appeal_brings_help_and_priority(client):
    ana = join(client, "Crisis Appeal")
    pid = post(client, ana, "Buy now with promo code HEAL").json()["post"]["id"]
    r = client.post(f"{API}/posts/{pid}/appeal", json={"text": "I want to end my life, nobody listens to me"},
                    headers=ana).json()
    assert r["safety"]["level"] == "emergency" and r["safety"]["resources"]
    assert client.get(f"{ADMIN}/appeals").json()[0]["priority"] == 2


def test_overturning_lifts_an_automatic_suspension(tmp_path, corpus):
    with app_with(tmp_path, corpus, community_strikes_to_suspend=1) as (client, _):
        ana = join(client, "Suspended Sam")
        pid = post(client, ana, "My honest story about the first week of chemo").json()["post"]["id"]
        remove(client, pid)
        assert client.get(f"{API}/members/me", headers=ana).json()["member"]["status"] == "suspended"
        assert post(client, ana, "Can I still post?").status_code == 403
        appeal = client.post(f"{API}/posts/{pid}/appeal", json={"text": "Please look again, it was my own story."},
                             headers=ana)
        assert appeal.status_code == 201  # suspended members can still appeal
        client.post(f"{ADMIN}/appeals/{appeal.json()['appeal']['id']}", json={"action": "overturn"})
        assert client.get(f"{API}/members/me", headers=ana).json()["member"]["status"] == "active"


# ── transparency report & health metrics ─────────────────────────────────────────────────────────────────────
def test_transparency_report_counts_steps_without_identifying_anyone(tmp_path, corpus):
    with app_with(tmp_path, corpus, transparency_min_cell=1) as (client, _):
        ana, ben = join(client, "Report Ana"), join(client, "Report Ben")
        ok = post(client, ana, "Three walks this week!").json()["post"]["id"]
        post(client, ana, "Call me on +33 6 12 34 56 78 and we can talk")  # returned to author
        held = post(client, ana, "Apricot kernels cure cancer, my aunt proved it").json()["post"]["id"]
        client.post(f"{API}/posts/{ok}/reports", json={"reason": "spam"}, headers=ben)
        remove(client, held)
        client.post(f"{API}/posts/{held}/appeal", json={"text": "It was a question, not advice."}, headers=ana)

        r = client.get("/api/v1/transparency")
        assert r.status_code == 200 and "no-store" not in r.headers["cache-control"]  # public, cacheable
        report = r.json()
        assert report["posts"] == {"submitted": 2, "held_for_review": 1, "returned_to_author": 1,
                                   "hidden_after_reports": 0}
        assert report["held_by_reason"] == {"medical_claim": 1}
        assert report["returned_by_reason"] == {"contact_details": 1}
        assert report["reports_by_reason"] == {"spam": 1}
        assert report["decisions"]["removed"] == 1 and report["decisions"]["removed_by_reason"] == {"medical_claim": 1}
        assert report["appeals"] == {"received": 1, "overturned": 0, "upheld": 0}
        assert report["complete"] is False and report["available"][0] == report["quarter"]
        text = r.text
        assert "Report Ana" not in text and "Apricot" not in text and "member" not in text

        assert client.get("/api/v1/transparency", params={"quarter": "2026-Q5"}).status_code == 422
        past = client.get("/api/v1/transparency", params={"quarter": "2020-q1"}).json()
        assert past["quarter"] == "2020-Q1" and past["complete"] is True and past["posts"]["submitted"] == 0

        stats = client.get(f"{ADMIN}/stats").json()
        assert {"members", "posts_published", "posts_held", "open_reports", "suspended_members"} <= stats.keys()
        assert stats["open_appeals"] == 1
        assert stats["health"]["submitted"] == 2 and stats["health"]["held_share"] == 0.5
        assert stats["health"]["reports_per_100_posts"] == 50.0


def test_small_numbers_are_suppressed_by_default(client):
    ana = join(client, "Small Numbers")
    post(client, ana, "Apricot kernels cure cancer, my aunt proved it")
    report = client.get("/api/v1/transparency").json()
    assert report["min_cell"] == 5
    assert report["posts"]["submitted"] is None and report["held_by_reason"] == {"medical_claim": None}
    assert report["posts"]["returned_to_author"] == 0  # zero is not identifying
    assert report["felt_supported"] is None


def test_quarter_bounds():
    from app.community.transparency import quarter_bounds

    assert quarter_bounds("2026-Q4")[1:] == (datetime(2026, 10, 1, tzinfo=UTC), datetime(2027, 1, 1, tzinfo=UTC))
    assert quarter_bounds(None, datetime(2026, 5, 9, tzinfo=UTC))[0] == "2026-Q2"


# ── "I felt supported" ───────────────────────────────────────────────────────────────────────────────────────
def test_felt_supported_survey_is_occasional_and_anonymous_in_aggregate(client, container):
    from app.db.models import CommunityMemberRow, CommunitySurveyRow

    ana = join(client, "Survey Ana")
    assert client.get(f"{API}/survey", headers=ana).json() == {"due": False, "last_answered_at": None}  # too new
    assert client.post(f"{API}/survey", json={"answer": "yes"}, headers=ana).status_code == 409
    with container.db.session() as s:
        s.query(CommunityMemberRow).update({"created_at": datetime.now(UTC) - timedelta(days=8)})
    assert client.get(f"{API}/survey", headers=ana).json()["due"] is True
    assert client.post(f"{API}/survey", json={"answer": "maybe"}, headers=ana).status_code == 422
    r = client.post(f"{API}/survey", json={"answer": "somewhat"}, headers=ana)
    assert r.status_code == 201 and r.json()["due"] is False
    assert client.post(f"{API}/survey", json={"answer": "yes"}, headers=ana).status_code == 409  # once a month
    assert client.get(f"{ADMIN}/stats").json()["felt_supported_90d"] == {
        "responses": 1, "yes": 0.0, "somewhat": 1.0, "no": 0.0}
    assert client.get(f"{API}/members/me/export", headers=ana).json()["survey_answers"][0]["answer"] == "somewhat"
    client.delete(f"{API}/members/me", headers=ana)
    with container.db.session() as s:  # erasure unlinks the answer; the aggregate stays
        assert [r.member_id for r in s.query(CommunitySurveyRow)] == [None]


# ── clinical review of insights (INSIGHT_REVIEW_REQUIRED) ────────────────────────────────────────────────────
def test_review_required_keeps_unapproved_insights_private(tmp_path, corpus):
    topic = "quitting-smoking"
    with app_with(tmp_path, corpus, insight_review_required=True) as (client, c):
        c.ingestion.sync()
        c.insights.build_all(topic_ids=[topic], languages=["en"])
        iid = f"{topic}.en"
        assert client.get(f"/api/v1/insights/{iid}").status_code == 404  # nothing public before sign-off
        assert client.get("/api/v1/insights", params={"lang": "en", "include_insufficient": True}).json()["total"] == 0
        pending = client.get("/api/v1/admin/insights/review").json()
        assert [p["insight"]["id"] for p in pending] == [iid] and pending[0]["has_public_version"] is False
        assert pending[0]["insight"]["key_points"] and pending[0]["insight"]["citations"]

        r = client.post(f"/api/v1/admin/insights/{iid}/review",
                        json={"decision": "approved", "reviewer": "Dr A. Example, oncologist"})
        assert r.status_code == 200 and r.json()["status"] == "published"
        live = client.get(f"/api/v1/insights/{iid}").json()
        assert live["status"] == "published" and live["reviewed_at"] and live["version"] == 1
        assert client.get("/api/v1/admin/insights/review").json() == []
        assert client.get("/api/v1/admin/insights/review", params={"state": "unreviewed"}).json() == []

        # a rebuild becomes a draft; the public version is unchanged until approved
        c.insights.build_all(topic_ids=[topic], languages=["en"], force=True)
        assert client.get(f"/api/v1/insights/{iid}").json()["version"] == 1
        assert client.get("/api/v1/admin/insights/review").json()[0]["has_public_version"] is True
        c.insights.build_all(topic_ids=[topic], languages=["en"])  # unchanged evidence: no duplicate draft
        assert len(client.get("/api/v1/admin/insights/review").json()) == 1
        client.post(f"/api/v1/admin/insights/{iid}/review", json={"decision": "rejected", "reviewer": "Dr B"})
        assert client.get(f"/api/v1/insights/{iid}").json()["version"] == 1
        assert len(client.get("/api/v1/admin/insights/review", params={"state": "rejected"}).json()) == 1

        # withdraw and restore the public insight
        client.post(f"/api/v1/admin/insights/{iid}/review", json={"decision": "rejected", "reviewer": "Dr B"})
        assert client.get(f"/api/v1/insights/{iid}").status_code == 404
        assert [w["insight"]["id"] for w in client.get("/api/v1/admin/insights/review",
                                                       params={"state": "withdrawn"}).json()] == [iid]
        client.post(f"/api/v1/admin/insights/{iid}/review", json={"decision": "approved", "reviewer": "Dr A"})
        assert client.get(f"/api/v1/insights/{iid}").status_code == 200
        assert client.post("/api/v1/admin/insights/nope.en/review",
                           json={"decision": "approved", "reviewer": "Dr A"}).status_code == 404


def test_review_is_off_by_default_and_sign_off_is_recorded(built_client):
    insight = built_client.get("/api/v1/insights/quitting-smoking.en").json()
    assert insight["status"] == "published" and insight["reviewed_at"] is None
    unreviewed = built_client.get("/api/v1/admin/insights/review", params={"state": "unreviewed"}).json()
    assert "quitting-smoking.en" in [u["insight"]["id"] for u in unreviewed]


# ── model canary ─────────────────────────────────────────────────────────────────────────────────────────────
class FakeLLM:
    name = "fake"

    def __init__(self, model: str) -> None:
        self.model = model

    async def stream(self, messages, **_):
        yield "Quitting smoking lowers the risk of lung cancer [1]."

    async def complete(self, messages, **_):
        return ""

    async def health(self):
        return True

    async def aclose(self):
        pass


def test_canary_is_off_by_default(settings):
    from app.llm.providers import build_canary

    assert build_canary(settings) is None
    llm_settings = settings.model_copy(update={"llm_provider": "openai_compatible"})
    assert build_canary(llm_settings) is None
    on = llm_settings.model_copy(update={"llm_canary_model": "adapter-v2", "llm_canary_percent": 10.0})
    canary = build_canary(on)
    assert canary is not None and canary.model == "adapter-v2"


def test_canary_takes_its_share_of_answers(tmp_path, corpus):
    from app.core.metrics import LLM_VARIANT_ANSWERS

    def count(variant: str) -> float:
        return LLM_VARIANT_ANSWERS.labels(variant=variant, mode="llm")._value.get()

    with app_with(tmp_path, corpus, llm_canary_percent=100.0) as (client, c):
        c.ingestion.sync()
        c.chat.llm, c.chat.canary = FakeLLM("stable-model"), FakeLLM("candidate-model")
        before = count("canary")
        body = {"messages": [{"role": "user", "content": "Does quitting smoking lower cancer risk?"}], "stream": False}
        assert client.post("/api/v1/chat", json=body).json()["model"] == "candidate-model"
        assert count("canary") == before + 1
        c.settings.llm_canary_percent = 0.0
        assert client.post("/api/v1/chat", json=body).json()["model"] == "stable-model"


# ── end-to-end-encrypted device sync ─────────────────────────────────────────────────────────────────────────
def creds() -> tuple[str, dict[str, str]]:
    code = os.urandom(16)
    sync_id = hashlib.sha256(b"id" + code).hexdigest()
    auth = base64.urlsafe_b64encode(hashlib.sha256(b"auth" + code).digest()).decode().rstrip("=")
    return sync_id, {"Authorization": f"Bearer {auth}"}


def blob(n: int = 64) -> str:
    return base64.urlsafe_b64encode(os.urandom(n)).decode().rstrip("=")


def test_device_sync_stores_only_ciphertext_with_versions(client):
    assert client.get("/api/v1/sync").json() == {"enabled": True, "max_bytes": 256 * 1024}
    sync_id, auth = creds()
    url = f"/api/v1/sync/{sync_id}"
    assert client.get(url, headers=auth).status_code == 404
    assert client.put(url, json={"ciphertext": blob(), "version": 0}).status_code == 401
    first = blob()
    r = client.put(url, json={"ciphertext": first, "version": 0}, headers=auth)
    assert r.status_code == 200 and r.json()["version"] == 1 and r.json()["ciphertext"] == ""
    assert r.headers["cache-control"] == "no-store"
    got = client.get(url, headers=auth)
    assert got.json()["ciphertext"] == first and got.headers["cache-control"] == "no-store"

    stale = client.put(url, json={"ciphertext": blob(), "version": 0}, headers=auth)
    assert stale.status_code == 409 and stale.headers["x-sync-version"] == "1"
    assert client.put(url, json={"ciphertext": blob(), "version": 1}, headers=auth).json()["version"] == 2

    _, other = creds()
    assert client.get(url, headers=other).status_code == 404  # wrong secret: same answer as "absent"
    assert client.put(url, json={"ciphertext": blob(), "version": 2}, headers=other).status_code == 404
    assert client.get("/api/v1/sync/not-an-id", headers=auth).status_code == 404
    assert client.put(url, json={"ciphertext": "not base64!" * 4, "version": 2}, headers=auth).status_code == 422
    assert client.put(url, json={"ciphertext": blob(300 * 1024), "version": 2}, headers=auth).status_code == 413
    assert client.delete(url, headers=auth).status_code == 204
    assert client.get(url, headers=auth).status_code == 404


def test_device_sync_limits_and_switch(tmp_path, corpus):
    with app_with(tmp_path, corpus, device_sync_writes_per_minute=2) as (client, _):
        sync_id, auth = creds()
        url = f"/api/v1/sync/{sync_id}"
        codes = [client.put(url, json={"ciphertext": blob(), "version": v}, headers=auth).status_code
                 for v in (0, 1, 2)]
        assert codes == [200, 200, 429]
    with app_with(tmp_path / "off", corpus, device_sync_enabled=False) as (client, _):
        assert client.get("/api/v1/sync").json()["enabled"] is False
        assert client.get(f"/api/v1/sync/{'a' * 64}").status_code == 404


def test_retention_covers_sync_blobs_and_survey_answers(client, container):
    from app.db.models import CommunitySurveyRow, SyncBlobRow
    from app.services.retention import run_retention

    sync_id, auth = creds()
    client.put(f"/api/v1/sync/{sync_id}", json={"ciphertext": blob(), "version": 0}, headers=auth)
    with container.db.session() as s:
        s.add(CommunitySurveyRow(answer="yes", language="en", created_at=datetime.now(UTC) - timedelta(days=400)))
        s.get(SyncBlobRow, sync_id).updated_at = datetime.now(UTC) - timedelta(days=401)
    result = run_retention(container.settings, container.db)
    assert result["sync_blobs"] == 1 and result["survey_answers"] == 1


@pytest.mark.parametrize("path", ["/api/v1/transparency", "/api/v1/sync"])
def test_new_public_endpoints_are_in_the_openapi_contract(client, path):
    assert path in client.get("/openapi.json").json()["paths"]
