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
    assert len(topics) == 38 and any(t["status"] == "published" for t in topics)

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


def test_streamed_final_event_is_always_complete(built_client):
    """Regression: abstained/safety-blocked finals must carry every ChatResponse field (clients read them)."""
    for question in ["I have crushing chest pain and can't breathe", "Is radon at home a cause of lung cancer?"]:
        events = parse_sse(built_client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": question}]}).text)
        final = next(data for name, data in events if name == "final")
        for key in ("citations", "related_insights", "output_flags", "evidence", "verification", "timings_ms", "retrieved"):
            assert key in final, key
        assert final["abstained"] is True
