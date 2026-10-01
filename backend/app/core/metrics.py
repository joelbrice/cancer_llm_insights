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
