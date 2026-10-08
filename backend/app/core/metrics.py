"""Prometheus metrics (scraped at /metrics). One process per pod keeps metrics consistent."""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

HTTP_REQUESTS = Counter("http_requests_total", "HTTP requests", ["method", "route", "status"])
HTTP_LATENCY = Histogram(
    "http_request_duration_seconds", "HTTP request latency", ["method", "route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
CHAT_REQUESTS = Counter("chat_requests_total", "Chat requests", ["language", "safety", "outcome"])
CHAT_STAGE_SECONDS = Histogram("chat_stage_seconds", "Chat pipeline stage latency", ["stage"],
                               buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60))
JOBS = Counter("jobs_total", "Background jobs", ["kind", "status"])
INDEXED_DOCUMENTS = Gauge("indexed_documents", "Documents indexed and searchable")
PUBLISHED_INSIGHTS = Gauge("published_insights", "Evidence-graded insights published")
FEEDBACK = Counter("feedback_total", "User feedback", ["target_type", "rating"])

# ── Answer quality and safety (alerting: deploy/monitoring/alerts.yaml, docs/BUILD_SPEC.md §7.3) ──────────
CHAT_ANSWERS = Counter("chat_answers_total", "Answers by generation mode", ["language", "mode"])  # llm|extractive|extractive_fallback
GROUNDED_RATIO = Histogram("chat_grounded_ratio", "Share of verified statements per answer",
                           buckets=(0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0))
UNSUPPORTED_CLAIMS = Counter("chat_unsupported_claims_total", "Statements flagged as unsupported by their source")
SAFETY_TRIGGERS = Counter("safety_triggers_total", "Safety rules triggered", ["rule", "language", "surface"])
COMMUNITY_POSTS = Counter("community_posts_total", "Community posts and replies by screening outcome",
                          ["outcome", "reason"])  # published|held|rejected
