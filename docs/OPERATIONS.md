# Stepwell — Operations runbook

## First start (Docker Compose)

```bash
cp .env.example .env      # set POSTGRES_PASSWORD, ADMIN_API_KEY, QDRANT_API_KEY (openssl rand -hex 32)
docker compose up -d --build
open http://localhost:3000/en/admin     # enter the admin key
```

1. Put documents in `data/raw/{research,guidelines,web,blogs}`, or link a bucket in `data/sources.yaml` (or in the
   console).
2. Press **Test connection**, then **Sync now**.
3. Insights build automatically after ingestion.

Until then the platform shows "the evidence library is being prepared". That is the expected **awaiting data**
state.

## Checks

| What | How |
|---|---|
| Health / readiness | `GET /healthz` (process) · `GET /readyz` (database + vector store) |
| Configuration | `docker compose exec api cancer-insights doctor` |
| Metrics | `GET /metrics` (Prometheus; cluster-internal) |
| Alerts | `deploy/monitoring/alerts.yaml`: crisis posts waiting, grounded ratio, fallback share, unsupported claims, safety-rate shifts, API errors, latency, failing jobs, empty library |
| Jobs | Admin console → Jobs, or `GET /api/v1/admin/jobs` |
| Quality | Admin console → **Run evaluation** (golden sets in `data/eval/`) |

## Routine tasks

| Frequency | Task |
|---|---|
| Daily (automatic) | Library sync every 5 min. Retention purge (removed community posts > 90 days, feedback > 12 months, chat traces > 30 days). |
| Daily | Moderation queue (crisis items first). Check alerts for grounded ratio, fallback share and safety-trigger rate. |
| Weekly | Triage "not helpful" feedback. Moderator calibration. |
| Monthly | Clinical review of a 10 % insight sample. Review safety-rule misses. Dependency and image updates. |
| Quarterly | Verify crisis lines for every launch country. Community transparency report. Restore drill (database + vectors). |

## Changing the embedding model

Vectors are not comparable across models. After you change `EMBEDDING_MODEL`:

1. Run `cancer-insights reset-index --yes`.
2. Run a full sync.

## Releasing a new fine-tuned model

1. Train and evaluate (see `ml/README.md`); all gates must pass.
2. The CSO signs the report.
3. Deploy the adapter to the vLLM server as a new LoRA name.
4. Route 10 % of traffic for 48 hours (canary) and compare metrics.
5. Switch `LLM_MODEL`.
6. To roll back, switch `LLM_MODEL` back.

## Incidents

1. Assess severity (`docs/BUILD_SPEC.md` §14.4).
2. Contain. Options include:
   - disable the community (`COMMUNITY_ENABLED=false`);
   - force extractive mode (`LLM_PROVIDER=extractive`);
   - roll back the image.
3. Inform the CSO and DPO.
4. Write a post-mortem.

## Backups

- PostgreSQL: point-in-time recovery (managed service or WAL archiving).
- Qdrant: daily snapshots. Vectors can always be rebuilt from the library with a full sync.
- Evidence library: versioned object storage.
- `data/sources.yaml`: kept in version control (no secrets — `${ENV}` references only).
