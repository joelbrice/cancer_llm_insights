"""Peer-support community: membership, screening, encouragement, moderation, privacy rights."""

import pytest

from app.community.moderation import CommunityConfig, CommunityModerator, handle_key
from app.safety.guardrails import Guardrails

API = "/api/v1/community"
CONSENT = {"accept_guidelines": True, "confirm_age": True, "consent_health_data": True}


def join(client, handle: str, **extra) -> dict[str, str]:
    r = client.post(f"{API}/members", json={"handle": handle, "language": "en", **CONSENT, **extra})
    assert r.status_code == 201, r.text
    return {"X-Member-Token": r.json()["token"]}


def post(client, headers, body: str, circle: str = "prevention", kind: str = "win", **kw):
    return client.post(f"{API}/posts", json={"circle": circle, "kind": kind, "body": body, **kw}, headers=headers)


# ── moderation engine (unit) ─────────────────────────────────────────────────────────────────────────────────
mod = CommunityModerator(CommunityConfig(), Guardrails())


@pytest.mark.parametrize(("text", "action", "reason"), [
    ("Three walks this week and I feel stronger!", "publish", None),
    ("I walked 10 000 steps a day between 2019-2023, then again on 12.05.2024", "publish", None),
    ("Great overview here: https://www.who.int/news-room/fact-sheets/detail/cancer", "publish", None),
    ("Call me on +33 6 12 34 56 78 and we can talk", "reject", "contact_details"),
    ("write to me: jane.doe@example.com", "reject", "contact_details"),
    ("Read this miracle protocol at bestcures.shop/protocol", "reject", "links"),
    ("I want to end my life, I can't do this anymore", "hold", "crisis"),
    ("I have crushing chest pain and can't breathe", "hold", "emergency"),
    ("I'm on chemo and I have a fever of 38.5 tonight", "hold", "urgent"),
    ("Apricot kernels cure cancer, my aunt proved it", "hold", "medical_claim"),
    ("You should stop your chemo, it's poison", "hold", "medical_claim"),
    ("DM me for a discount code on my shop's supplements", "hold", "solicitation"),
    ("Shut up, you deserved it", "hold", "abuse"),
])
def test_screening(text, action, reason):
    s = mod.screen(text, "en")
    assert (s.action, s.reason) == (action, reason), s


def test_crisis_posts_bring_help_to_the_author():
    s = mod.screen("Je veux me suicider, je n'en peux plus", "fr", country="FR")
    assert s.action == "hold" and s.priority == 2
    assert s.safety is not None and s.safety.level == "emergency"
    assert any("3114" in r.contact for r in s.safety.resources)


def test_treatment_questions_get_a_care_team_note_not_a_block():
    s = mod.screen("Should I stop my chemotherapy and try juicing instead?", "en")
    assert s.action == "publish" and s.notes == ["care_team"]


@pytest.mark.parametrize(("handle", "error"), [
    ("Brave Willow", None), ("Élodie_74", None), ("Dr Martin", "handle_reserved"), ("Nurse Joy", "handle_reserved"),
    ("Stepwell Team", "handle_reserved"), ("x", "handle_format"), ("12345", "handle_format"),
    ("idiot king", "handle_abuse"),
])
def test_handles(handle, error):
    assert mod.check_handle(handle) == error


def test_handle_key_is_case_and_accent_insensitive():
    assert handle_key("Élodie 74") == handle_key("elodie_74")


# ── API ──────────────────────────────────────────────────────────────────────────────────────────────────────
def test_meta_is_public_and_localised(client):
    meta = client.get(f"{API}/meta", params={"lang": "fr"}).json()
    assert [c["id"] for c in meta["circles"]] == ["prevention", "in_treatment", "after_treatment", "caregivers"]
    assert meta["circles"][1]["title"] == "Pendant les traitements" and meta["circles"][1]["prompt"].endswith("?")
    assert meta["reactions"] == ["support", "strength", "thanks", "inspired"] and meta["min_age"] == 18


def test_joining_requires_consent_and_unique_safe_handle(client):
    r = client.post(f"{API}/members", json={"handle": "Quiet Oak", "accept_guidelines": True, "confirm_age": False,
                                             "consent_health_data": True})
    assert r.status_code == 422 and r.json()["error"]["message"] == "consent_required"
    assert client.post(f"{API}/members", json={"handle": "Dr Who", **CONSENT}).status_code == 422
    join(client, "Quiet Oak")
    assert client.post(f"{API}/members", json={"handle": "quiet  OAK", **CONSENT}).status_code == 409


def test_community_is_members_only_and_never_cached(client):
    r = client.get(f"{API}/posts")
    assert r.status_code == 401
    assert r.headers["cache-control"] == "private, no-store" and "noindex" in r.headers["x-robots-tag"]
    assert client.get(f"{API}/posts", headers={"X-Member-Token": "forged"}).status_code == 401


def test_encouragement_loop(client):
    ana, ben = join(client, "Ana Sunrise", journey="after_treatment"), join(client, "Ben Harbor")
    created = post(client, ana, "Finished my first 20-minute walk since treatment ended!", circle="after_treatment")
    assert created.status_code == 201
    body = created.json()
    assert body["moderation"]["status"] == "published" and body["post"]["author"]["journey"] == "after_treatment"
    pid = body["post"]["id"]

    feed = client.get(f"{API}/posts", params={"circle": "after_treatment"}, headers=ben).json()
    assert feed["items"][0]["id"] == pid and feed["items"][0]["author"] == {
        "handle": "Ana Sunrise", "journey": "after_treatment", "is_me": False}

    reacted = client.put(f"{API}/posts/{pid}/reactions/strength", headers=ben).json()
    assert reacted == {"reactions": {"strength": 1}, "my_reactions": ["strength"]}
    assert client.put(f"{API}/posts/{pid}/reactions/thumbs_down", headers=ben).status_code == 422
    reply = client.post(f"{API}/posts/{pid}/replies", json={"body": "That's a big step — well done!"}, headers=ben)
    assert reply.status_code == 201

    thread = client.get(f"{API}/posts/{pid}", headers=ana).json()
    assert thread["post"]["reply_count"] == 1 and thread["replies"][0]["author"]["handle"] == "Ben Harbor"

    me = client.get(f"{API}/members/me", headers=ana).json()
    assert me["activity"]["new_replies"] == 1 and me["activity"]["new_reactions"] == 1
    assert {i["type"] for i in me["activity"]["recent"]} == {"reply", "reaction"}
    client.post(f"{API}/members/me/seen", headers=ana)
    me = client.get(f"{API}/members/me", headers=ana).json()
    assert me["activity"]["new_replies"] == 0 and len(me["activity"]["recent"]) == 2

    removed = client.delete(f"{API}/posts/{pid}/reactions/strength", headers=ben).json()
    assert removed == {"reactions": {}, "my_reactions": []}


def test_held_posts_are_private_to_their_author_with_help(client):
    ana, ben = join(client, "Ana Willow"), join(client, "Ben Cedar")
    r = client.post(f"{API}/posts", json={"circle": "in_treatment", "kind": "encouragement",
                                          "body": "I want to end my life, I can't do this anymore"},
                    headers={**ana, "X-Country": "gb"})
    assert r.status_code == 201
    outcome = r.json()["moderation"]
    assert outcome["status"] == "held" and outcome["reason"] == "crisis"
    assert any(res["contact"] == "116 123" for res in outcome["safety"]["resources"])
    pid = r.json()["post"]["id"]
    assert client.get(f"{API}/posts", headers=ana).json()["items"][0]["status"] == "held"
    assert client.get(f"{API}/posts", headers=ben).json()["items"] == []
    assert client.get(f"{API}/posts/{pid}", headers=ben).status_code == 404

    rejected = post(client, ana, "text me on 07700 900123 please")
    assert rejected.status_code == 422 and rejected.json()["error"]["message"] == "contact_details"


def test_reports_moderation_and_strikes(client):
    author = join(client, "Rowan Field")
    reporters = [join(client, f"Helper {n}") for n in ("One", "Two", "Three")]
    pid = post(client, author, "Sharing my favourite soup recipe for tired days", circle="in_treatment",
               kind="tip").json()["post"]["id"]
    assert client.post(f"{API}/posts/{pid}/reports", json={"reason": "spam"}, headers=author).status_code == 422
    for headers in reporters:
        assert client.post(f"{API}/posts/{pid}/reports", json={"reason": "spam"}, headers=headers).status_code == 202
    assert client.get(f"{API}/posts", headers=reporters[0]).json()["items"] == []  # auto-hidden at threshold

    queue = client.get("/api/v1/admin/community/queue").json()
    item = next(i for i in queue if i["post"]["id"] == pid)
    assert len(item["reports"]) == 3 and "reported" in item["flags"]
    approved = client.post(f"/api/v1/admin/community/posts/{pid}/moderate", json={"action": "approve"}).json()
    assert approved["status"] == "published"
    assert client.get(f"{API}/posts", headers=reporters[0]).json()["items"][0]["id"] == pid

    for i in range(3):  # three removed posts → automatic suspension
        bad = post(client, author, f"Buy now with promo code HEAL{i}!").json()["post"]["id"]
        assert client.post(f"/api/v1/admin/community/posts/{bad}/moderate", json={"action": "remove"}).status_code == 200
    assert post(client, author, "Hello again").status_code == 403
    assert client.get(f"{API}/posts", headers=author).status_code == 200  # suspended members can still read
    stats = client.get("/api/v1/admin/community/stats").json()
    assert stats["posts_removed"] == 3 and stats["suspended_members"] == 1


def test_export_and_erasure_keep_other_peoples_replies(client):
    ana, ben = join(client, "Ana Maple"), join(client, "Ben Brook")
    pid = post(client, ana, "First week back at work, nervous but okay", circle="after_treatment").json()["post"]["id"]
    post(client, ana, "A second post with no replies", circle="after_treatment")
    client.post(f"{API}/posts/{pid}/replies", json={"body": "Proud of you, take it slowly"}, headers=ben)

    exported = client.get(f"{API}/members/me/export", headers=ana).json()
    assert exported["member"]["handle"] == "Ana Maple" and len(exported["posts"]) == 2

    assert client.delete(f"{API}/members/me", headers=ana).status_code == 204
    assert client.get(f"{API}/members/me", headers=ana).status_code == 401
    thread = client.get(f"{API}/posts/{pid}", headers=ben).json()
    assert thread["post"]["status"] == "deleted" and thread["post"]["body"] == "" and thread["post"]["author"] is None
    assert thread["replies"][0]["body"] == "Proud of you, take it slowly"
    assert [p["id"] for p in client.get(f"{API}/posts", headers=ben).json()["items"]] == []


def test_rate_limits_and_pagination(tmp_path, corpus):
    from fastapi.testclient import TestClient

    from app.container import Container
    from app.main import create_app
    from tests.conftest import make_settings

    settings = make_settings(tmp_path, corpus, community_posts_per_hour=3)
    container = Container(settings)
    with TestClient(create_app(settings, container)) as c:
        me = join(c, "Steady Pine")
        ids = [post(c, me, f"Small win number {i}").json()["post"]["id"] for i in range(3)]
        assert post(c, me, "One more").status_code == 429
        first = c.get(f"{API}/posts", params={"limit": 2}, headers=me).json()
        second = c.get(f"{API}/posts", params={"limit": 2, "cursor": first["next_cursor"]}, headers=me).json()
        assert [p["id"] for p in first["items"] + second["items"]] == ids[::-1] and second["next_cursor"] is None
    container.close()


def test_posts_link_to_what_the_research_says(built_client):
    me = join(built_client, "Morning Walker")
    r = post(built_client, me, "Started walking every day after reading that physical activity lowers cancer risk.")
    related = r.json()["post"]["related_insight"]
    assert related and related["id"] == "physical-activity-prevention.en" and related["evidence_level"] == "high"


def test_cross_origin_clients_can_use_the_community(client):
    """Expo web / other origins send X-Member-Token and use PUT for reactions: the CORS preflight must allow them."""
    r = client.options(f"{API}/posts/p_x/reactions/support", headers={
        "Origin": "http://localhost:8081", "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "x-member-token,x-country,content-type"})
    assert r.status_code == 200
    allowed = r.headers["access-control-allow-headers"].lower()
    assert "x-member-token" in allowed and "x-country" in allowed and "PUT" in r.headers["access-control-allow-methods"]
