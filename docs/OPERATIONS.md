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
| Daily (automatic) | Library sync every 5 min. Retention purge (removed community posts > 90 days, feedback and survey answers > 12 months, chat traces > 30 days, encrypted sync copies untouched > 400 days). |
| Daily | Moderation queue (crisis items first) and appeals. Check alerts for grounded ratio, fallback share and safety-trigger rate. |
| Weekly | Triage "not helpful" feedback. Moderator calibration. |
| Monthly | Clinical review of a 10 % insight sample (Admin console → **Clinical review**). Review safety-rule misses. Dependency and image updates. |
| Quarterly | Verify crisis lines for every launch country. Read the transparency report for the quarter that ended (`/transparency`, generated automatically) and add context in the guidelines if needed. Restore drill (database + vectors). |

## Changing the embedding model

Vectors are not comparable across models. After you change `EMBEDDING_MODEL`:

1. Run `cancer-insights reset-index --yes`.
2. Run a full sync.

## Releasing a new fine-tuned model

1. Train and evaluate (see `ml/README.md`); all gates must pass.
2. The CSO signs the report.
3. Deploy the adapter to the vLLM server as a new LoRA name.
4. Start the canary: `LLM_CANARY_MODEL=<new LoRA name>` and `LLM_CANARY_PERCENT=10`. Chat answers are assigned
   by a hash of the request id; insights keep using `LLM_MODEL`. Each answer reports the model that wrote it, and
   the `llm_variant_*` metrics (answers by mode, grounded ratio, unsupported claims) compare stable and canary.
5. After 48 hours with the canary at least as good, set `LLM_MODEL` to the new name and clear the canary
   (`LLM_CANARY_MODEL=`, `LLM_CANARY_PERCENT=0`).
6. To roll back during the canary, set `LLM_CANARY_PERCENT=0`; afterwards, switch `LLM_MODEL` back.

## Clinical review of insights

Admin console → **Clinical review of insights** lists insights by state: *Waiting for sign-off* (drafts),
*Published, not signed off*, *Refused* and *Withdrawn*. The reviewer enters their name and role, then signs off,
approves, refuses, withdraws or restores, with an optional note. Readers see "Reviewed by our clinical team" with
the date on signed-off insights.

- `INSIGHT_REVIEW_REQUIRED=false` (default): rebuilt insights publish immediately, as before; sign-off is recorded
  afterwards.
- `INSIGHT_REVIEW_REQUIRED=true` (recommended in production once the review rota is staffed): a rebuilt insight
  waits as a draft and the public one keeps its last approved content until the draft is approved.

## Community appeals and transparency

- Authors can appeal a held or removed post once. Appeals appear in Admin console → **Appeals**, most urgent
  first. *Reverse the decision* publishes the post and refunds the strike; *Confirm the decision* keeps it
  removed. The reply is shown to the author.
- The public report at `/transparency` (API: `GET /api/v1/transparency?quarter=2026-Q3`) is computed from an
  anonymous event ledger. Counts below `TRANSPARENCY_MIN_CELL` (default 5) are shown as "fewer than 5".
- The "I felt supported" question is asked at most every `COMMUNITY_SURVEY_INTERVAL_DAYS` (30), after
  `COMMUNITY_SURVEY_MIN_DAYS` (7) of membership. The 90-day result appears under **Community health** in the
  admin console.

## Encrypted sync

Optional for each person (`docs/BUILD_SPEC.md` §6.8). The server stores ciphertext it cannot read.

| Setting | Default | Purpose |
|---|---|---|
| `DEVICE_SYNC_ENABLED` | `true` | `false` turns the endpoints off (`/api/v1/sync/*` answers 404); apps keep working on the device |
| `DEVICE_SYNC_MAX_BYTES` | 262144 | Ciphertext size limit per person |
| `DEVICE_SYNC_WRITES_PER_MINUTE` | 10 | Write rate limit per sync id |
| `DEVICE_SYNC_RETENTION_DAYS` | 400 | Copies not updated for this long are deleted by the daily retention job |

Support cannot recover a lost code or read a copy: by design there is nothing to look up.

## Languages

`SUPPORTED_LANGUAGES` and `INSIGHT_LANGUAGES` default to `en,fr,es,pt,de,it,ar`. Insights are built for every
language in `INSIGHT_LANGUAGES`, so the first rebuild after upgrading adds the Italian and Arabic versions. The
existing languages are unchanged. To leave a language out, list the others explicitly. Crisis lines for each
launch country are in `backend/app/resources/safety.yaml`.

## Incidents

1. Assess severity (`docs/BUILD_SPEC.md` §14.4).
2. Contain. Options include:
   - disable the community (`COMMUNITY_ENABLED=false`);
   - force extractive mode (`LLM_PROVIDER=extractive`);
   - stop a model canary (`LLM_CANARY_PERCENT=0`);
   - turn off encrypted sync (`DEVICE_SYNC_ENABLED=false`);
   - roll back the image.
3. Inform the CSO and DPO.
4. Write a post-mortem.

## Backups

- PostgreSQL: point-in-time recovery (managed service or WAL archiving).
- Qdrant: daily snapshots. Vectors can always be rebuilt from the library with a full sync.
- Evidence library: versioned object storage.
- `data/sources.yaml`: kept in version control (no secrets — `${ENV}` references only).
