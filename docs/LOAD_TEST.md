# Load test

`scripts/loadtest/loadtest.py` runs virtual users through a realistic mix of reading and asking:

- page views: home, insights, an insight, library;
- API reads: insight list, insight, transparency report, community feed;
- evidence search;
- streamed answers.

It checks the p95 targets in BUILD_SPEC §12 and fails (exit code 1) when a target or the 1 % error budget is
missed.

```bash
# Compose topology (/api goes through the web server)
python scripts/loadtest/loadtest.py --base https://staging.stepwell.example --users 100 --duration 300
# Kubernetes topology (the ingress sends /api straight to the API)
python scripts/loadtest/loadtest.py --base https://staging.stepwell.example --api https://staging.stepwell.example \
    --users 100 --duration 300 --report loadtest-staging.md
# One tier only
python scripts/loadtest/loadtest.py --api http://localhost:8000 --steps api_,chat_,community_ --users 150
```

Run it against staging, never production. Rate limits apply per client address, so raise
`RATE_LIMIT_PER_MINUTE` and `CHAT_RATE_LIMIT_PER_MINUTE` on staging for the test, or the 429 responses count as
errors.

## Baseline: October 2026, local stack

**Setup:**

- one 4-core machine running everything: PostgreSQL 16, Redis 7 (rate limiter), the API, one Next.js web process
  and the load generator itself;
- the fixture library (11 documents), hashing embeddings, extractive answers (no GPU model);
- think time 1 s between a user's actions (0.5 s in the API-only run).

| Run | Users | Throughput | Errors | p95 pages | p95 API reads | p95 first answer text | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Mixed, Compose routing, 1 API worker | 50 | 42 req/s | 0 | 42 ms | 81 ms | 71 ms | all targets met |
| API only, 3 workers | 150 | 242 req/s | 0 | — | 74 ms | 60 ms | all targets met |
| Pages only, one web process | 40 | 32 pages/s | 0 | 61 ms | — | — | all targets met |
| Pages only, one web process | 80 | 57 pages/s | 0 | 153 ms | — | — | all targets met |
| Mixed, Kubernetes routing, 3 API workers | 200 | 78 req/s | 0 | 3.0 s | 3.8 s | 3.7 s | targets missed: saturated |

**What saturates first:** at 200 mixed users, the single Next.js process and the load generator each used a full
core, while the three API workers used 30–50 % each. The limit is CPU on one machine and one web process, not the
API or the database. There were no errors at any load: requests queued and stayed correct.

**Against the expected load:** BUILD_SPEC §12 plans for 50 000 monthly users and 5 000 questions a day. Assuming
about 32 page views per user a month and a peak hour of 10 % of daily traffic, that is about 1.5 page views and
0.15 questions a second at peak. One web process and one API worker handle more than 20 times that within target.
Production starts with 2 web and 2 API replicas (2 workers each), and the autoscalers add more.

## Still to measure on staging (needs the real system)

The fixture library and extractive answers make retrieval and answering cheap. Before launch, re-run on staging
with:

- the real library, with Qdrant and multilingual-e5 embeddings: retrieval cost grows with the library;
- the GPU model (`--llm`, first-token target 2.5 s): generation dominates answer time and limits concurrent
  answers per GPU;
- the web and API replica counts planned for production, with traffic from more than one machine.

Record the results in this file.
