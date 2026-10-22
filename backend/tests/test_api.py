import json

import fsspec

from app.container import Container
from tests.conftest import make_settings
from tests.helpers import wait_for_job


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.split("\n") if ": " in line)
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def test_health_and_metrics(client):
    assert client.get("/healthz").json() == {"ok": True}
    ready = client.get("/readyz").json()
    assert ready["ok"] and ready["checks"] == {"database": True, "vector_store": True}
    assert "http_requests_total" in client.get("/metrics").text
    assert client.get("/healthz").headers["x-request-id"]


def test_platform_waits_for_data_then_becomes_ready(client):
    status = client.get("/api/v1/status").json()
    assert status["data_status"] == "awaiting_data" and status["documents"] == 0
    assert {s["id"] for s in status["sources"]} == {"research", "guidelines", "web", "blogs"}
    answer = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "Is exercise good?"}],
                                               "stream": False}).json()
    assert answer["abstained"] and answer["abstain_reason"] == "awaiting_data"

    job = client.post("/api/v1/admin/ingest", json={}).json()
    assert wait_for_job(client, job["id"])["status"] == "succeeded"
    status = client.get("/api/v1/status").json()
    assert status["data_status"] == "ready" and status["documents"] >= 10
    jobs = client.get("/api/v1/admin/jobs").json()
    insights_job = next(j for j in jobs if j["kind"] == "insights")  # chained automatically after ingestion
    assert wait_for_job(client, insights_job["id"])["status"] == "succeeded"
    assert client.get("/api/v1/status").json()["insights"] > 0


def test_meta_is_cacheable(client):
    response = client.get("/api/v1/meta")
    assert response.status_code == 200
    body = response.json()
    assert [lvl["id"] for lvl in body["evidence_levels"]][:2] == ["high", "moderate"]
    assert body["study_designs"][0]["tier"] == 1
    etag = response.headers["etag"]
    assert client.get("/api/v1/meta", headers={"If-None-Match": etag}).status_code == 304


def test_chat_streaming_event_order(built_client):
    response = built_client.post("/api/v1/chat", json={
        "messages": [{"role": "user", "content": "Does physical activity lower the risk of colon cancer?"}]})
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    names = [e[0] for e in events]
    assert names[0] == "meta" and names[1] == "evidence" and "delta" in names
    assert names[-2:] == ["final", "done"]
    final = events[-2][1]
    assert final["citations"] and final["evidence"]["level"] in ("high", "moderate")
    assert final["verification"]["grounded_ratio"] == 1.0
    streamed = "".join(e[1]["text"] for e in events if e[0] == "delta")
    assert streamed.strip() == final["answer"]


def test_chat_validation(built_client):
    r = built_client.post("/api/v1/chat", json={"messages": [{"role": "assistant", "content": "hi"}]})
    assert r.status_code == 422
    r = built_client.post("/api/v1/chat", json={"messages": []})
    assert r.status_code == 422 and r.json()["error"]["code"] == 422


def test_search_insights_documents_feedback(built_client):
    search = built_client.post("/api/v1/search", json={"query": "alcohol breast cancer"}).json()
    assert search["results"] and search["results"][0]["quote"]

    listing = built_client.get("/api/v1/insights", params={"lang": "en"}).json()
    assert listing["total"] >= 3
    first = listing["items"][0]
    detail = built_client.get(f"/api/v1/insights/{first['id']}").json()
    assert detail["citations"] and detail["evidence"]["rationale"]
    assert built_client.get("/api/v1/insights", params={"lang": "en", "min_level": "high"}).status_code == 200
    assert built_client.get("/api/v1/insights/nope").status_code == 404

    topics = built_client.get("/api/v1/topics", params={"lang": "fr"}).json()
    assert len(topics) == 43 and any(t["status"] == "published" for t in topics)

    docs = built_client.get("/api/v1/documents", params={"sort": "year"}).json()
    assert docs["total"] >= 9 and "meta_analysis" in docs["facets"]["source_type"]
    doc_id = detail["citations"][0]["source"]["document_id"]
    doc = built_client.get(f"/api/v1/documents/{doc_id}").json()
    assert doc["chunks"] and any(i["id"] == first["id"] for i in doc["cited_by"])
    chunk = built_client.get(f"/api/v1/chunks/{doc['chunks'][0]['id']}").json()
    assert chunk["document"]["id"] == doc_id

    fb = built_client.post("/api/v1/feedback", json={"target_type": "insight", "target_id": first["id"], "rating": 1,
                                                     "reasons": ["helpful"], "comment": "mail me a@b.co"})
    assert fb.status_code == 201


def test_admin_requires_key_when_configured(tmp_path, corpus):
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = make_settings(tmp_path, corpus, admin_api_key="s3cret")
    container = Container(settings)
    with TestClient(create_app(settings, container)) as client:
        assert client.get("/api/v1/admin/jobs").status_code == 401
        assert client.get("/api/v1/admin/jobs", headers={"X-Admin-Key": "wrong"}).status_code == 401
        assert client.get("/api/v1/admin/jobs", headers={"X-Admin-Key": "s3cret"}).status_code == 200
        assert client.get("/api/v1/admin/jobs", headers={"Authorization": "Bearer s3cret"}).status_code == 200
        assert client.get("/api/v1/status").json()["admin_protected"] is True
    container.close()


def test_admin_source_lifecycle_with_bucket(client):
    fs = fsspec.filesystem("memory")
    fs.pipe("/api-bucket/docs/hpv.md", b"---\ntitle: HPV fixture\nsource_type: systematic_review\n---\n"
            b"HPV vaccination is associated with large reductions in cervical precancer in vaccinated cohorts.")
    rejected = client.post("/api/v1/admin/sources", json={"id": "bad", "name": "Bad", "uri": "memory://x",
                                                          "storage_options": {"secret": "plaintext"}})
    assert rejected.status_code == 422
    created = client.post("/api/v1/admin/sources", json={"id": "bucket", "name": "Bucket",
                                                         "uri": "memory://api-bucket/docs",
                                                         "storage_options": {"secret": "${NOT_SET:-}"}})
    assert created.status_code == 201 and created.json()["kind"] == "memory"
    test = client.post("/api/v1/admin/sources/bucket/test").json()
    assert test["ok"] and test["sample"][0]["path"] == "hpv.md"
    job = client.post("/api/v1/admin/ingest", json={"source_ids": ["bucket"]}).json()
    assert wait_for_job(client, job["id"])["stats"]["documents_added"] == 1
    docs = client.get("/api/v1/documents", params={"q": "HPV fixture"}).json()
    assert docs["items"][0]["source_type"] == "systematic_review"
    assert client.patch("/api/v1/admin/sources/research", json={"uri": "/x"}).status_code == 422
    assert client.delete("/api/v1/admin/sources/bucket").status_code == 204
    assert client.get("/api/v1/admin/stats").status_code == 200


def test_rate_limit(tmp_path, corpus):
    from fastapi.testclient import TestClient

    import app.api.deps as deps
    from app.main import create_app

    deps._limiter = None
    settings = make_settings(tmp_path, corpus, rate_limit_per_minute=3)
    container = Container(settings)
    with TestClient(create_app(settings, container)) as client:
        codes = [client.post("/api/v1/search", json={"query": "alcohol"}).status_code for _ in range(5)]
        assert codes[:3] == [200, 200, 200] and codes[-1] == 429
    container.close()
    deps._limiter = None



def test_client_address_cannot_be_chosen_by_the_client():
    from starlette.requests import Request

    from app.api.deps import client_key

    def req(xff: str | None) -> Request:
        headers = [(b"x-forwarded-for", xff.encode())] if xff is not None else []
        return Request({"type": "http", "headers": headers, "client": ("10.0.0.9", 1234)})

    # One proxy appends the address it saw; whatever the client put before it is ignored.
    assert client_key(req("6.6.6.6, 203.0.113.7"), trust_forwarded=True) == "203.0.113.7"
    assert client_key(req("203.0.113.7"), trust_forwarded=True) == "203.0.113.7"
    # Two proxies (e.g. a load balancer and the ingress): the second entry from the right.
    assert client_key(req("6.6.6.6, 203.0.113.7, 10.1.2.3"), trust_forwarded=True, hops=2) == "203.0.113.7"
    assert client_key(req("203.0.113.7"), trust_forwarded=True, hops=3) == "203.0.113.7"
    # Without a proxy the header is not trusted at all.
    assert client_key(req("6.6.6.6"), trust_forwarded=False) == "10.0.0.9"
    assert client_key(req(None), trust_forwarded=True) == "10.0.0.9"
    assert client_key(req(" , "), trust_forwarded=True) == "10.0.0.9"


def test_rate_limit_holds_when_the_client_rotates_forwarded_for(tmp_path, corpus):
    from fastapi.testclient import TestClient

    import app.api.deps as deps
    from app.main import create_app

    deps._limiter = None
    settings = make_settings(tmp_path, corpus, rate_limit_per_minute=3, trust_forwarded_for=True)
    container = Container(settings)
    with TestClient(create_app(settings, container)) as client:
        codes = [client.post("/api/v1/search", json={"query": "alcohol"},
                             headers={"X-Forwarded-For": f"198.51.100.{i}, 203.0.113.7"}).status_code
                 for i in range(5)]
        assert codes[:3] == [200, 200, 200] and codes[-1] == 429
    container.close()
    deps._limiter = None


def test_request_log_has_no_client_address(client, caplog):
    import logging

    with caplog.at_level(logging.INFO, logger="app.access"):
        client.get("/api/v1/meta", headers={"X-Forwarded-For": "203.0.113.7"})
        client.get("/healthz")
    lines = [r.getMessage() for r in caplog.records if r.name == "app.access"]
    assert lines and all("203.0.113.7" not in line for line in lines)
    assert any(line.startswith("GET ") and "/meta 200" in line for line in lines)
    assert not any("/healthz" in line for line in lines)


def test_oversized_request_bodies_are_rejected(tmp_path, corpus):
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = make_settings(tmp_path, corpus, max_request_bytes=4096)
    container = Container(settings)
    with TestClient(create_app(settings, container)) as client:
        big = json.dumps({"query": "alcohol " * 1000})
        declared = client.post("/api/v1/search", content=big, headers={"Content-Type": "application/json"})
        assert declared.status_code == 413
        chunked = client.post("/api/v1/search", content=iter([big[:3000].encode(), big[3000:].encode()]),
                              headers={"Content-Type": "application/json"})
        assert chunked.status_code == 413
        assert chunked.json()["error"]["code"] == 413
        assert client.post("/api/v1/search", json={"query": "alcohol"}).status_code == 200
    container.close()

def test_streamed_final_event_is_always_complete(built_client):
    """Regression: abstained/safety-blocked finals must carry every ChatResponse field (clients read them)."""
    for question in ["I have crushing chest pain and can't breathe", "Is radon at home a cause of lung cancer?"]:
        events = parse_sse(built_client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": question}]}).text)
        final = next(data for name, data in events if name == "final")
        for key in ("citations", "related_insights", "output_flags", "evidence", "verification", "timings_ms", "retrieved"):
            assert key in final, key
        assert final["abstained"] is True


def test_quality_and_safety_metrics_are_exported(built_client):
    """Alert rules (deploy/monitoring/alerts.yaml) depend on these series."""
    built_client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "I have crushing chest pain and can't breathe"}]})
    built_client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "Does physical activity lower the risk of colon cancer?"}]})
    text = built_client.get("/metrics").text
    assert 'safety_triggers_total{language="en",rule="medical_emergency",surface="chat"}' in text
    assert 'chat_answers_total{language="en",mode="extractive"}' in text
    assert "chat_grounded_ratio_count" in text


def test_legal_details_come_from_settings(tmp_path, corpus):
    from fastapi.testclient import TestClient

    from app.main import create_app

    blank = make_settings(tmp_path / "a", corpus)
    container = Container(blank)
    with TestClient(create_app(blank, container)) as client:
        data = client.get("/api/v1/legal").json()
        assert data["approved"] is False and data["operator"]["name"] is None
        assert set(data["missing"]) >= {"name", "address", "email"}
    container.close()

    filled = make_settings(tmp_path / "b", corpus, legal_operator_name="Stepwell gGmbH",
                           legal_operator_address="Musterstraße 1 | 10115 Berlin | Germany",
                           legal_contact_email="hello@example.org", legal_content_responsible="A. Example",
                           legal_supervisory_authority="Berliner Beauftragte für Datenschutz",
                           legal_hosting="Hosting: Example Cloud, Frankfurt (EU)", legal_approved=True,
                           legal_effective_date="2026-11-01")
    container = Container(filled)
    with TestClient(create_app(filled, container)) as client:
        r = client.get("/api/v1/legal")
        data = r.json()
        assert data["operator"]["address"] == ["Musterstraße 1", "10115 Berlin", "Germany"]
        assert data["missing"] == [] and data["approved"] is True and data["effective_date"] == "2026-11-01"
        assert "ETag" in r.headers
    container.close()


def test_public_status_hides_source_locations_in_production(tmp_path, corpus):
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = make_settings(tmp_path, corpus, environment="production", admin_api_key="k" * 32)
    container = Container(settings)
    with TestClient(create_app(settings, container)) as client:
        sources = client.get("/api/v1/status").json()["sources"]
        assert sources and all(s["uri"] == f"{s['kind']}://…" for s in sources)
        assert str(corpus) not in client.get("/api/v1/status").text
        admin = client.get("/api/v1/admin/sources", headers={"X-Admin-Key": "k" * 32}).json()
        assert str(corpus) in json.dumps(admin)  # operators still see where data comes from
    container.close()
