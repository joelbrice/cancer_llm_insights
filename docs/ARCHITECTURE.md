# Stepwell — Architecture

## System context

```
                        ┌──────────────────────────── people (individuals & families) ───────────────────────────┐
                        │   Web / PWA (Next.js 16)        iOS · Android · web (Expo SDK 57)                      │
                        └───────────────┬──────────────────────────────────┬─────────────────────────────────────┘
                                        │ HTTPS (same-origin /api/v1 proxy) │ HTTPS (EXPO_PUBLIC_API_URL)
                                        ▼                                  ▼
 ┌──────────────────────────────────────────────── Stepwell engine (FastAPI) ─────────────────────────────────────────┐
 │  public API: status · chat (SSE) · search · insights · topics · documents · feedback · community (members-only)   │
 │  admin API (X-Admin-Key): sources · ingest · insights · evaluate · export SFT · jobs · community moderation        │
 │                                                                                                                   │
 │  safety guardrails ─▶ hybrid retrieval ─▶ rerank/MMR ─▶ answerability ─▶ generation ─▶ verification ─▶ grading     │
 │  community: screening (guardrails + PII/links + solicitation/abuse) ─▶ publish / hold / reject ─▶ evidence links   │
 └──────┬──────────────────────┬────────────────────────┬───────────────────────┬────────────────────┬────────────────┘
        │ SQL                  │ vectors (dense+sparse) │ queue                 │ OpenAI-compatible  │ fsspec
        ▼                      ▼                        ▼                       ▼                    ▼
   PostgreSQL               Qdrant                 Redis + workers         vLLM (Llama + LoRA)   evidence library
   documents, chunks,       hybrid search          ingest · insights ·     or Ollama / none      local folders · S3 ·
   insights, jobs,                                 evaluate · export ·     (extractive mode)     GCS · Azure · HTTPS
   community, feedback                             scheduler (leader)
```

## Components

| Component | Path | Responsibility |
|---|---|---|
| Data link | `backend/app/datasources/` | `sources.yaml` registry; URI parsing for `file`, `s3`, `gs`, `az`, `https` (manifest) and `memory`; `${ENV}` credential references (redacted in every response); connection tests |
| Ingestion | `backend/app/ingestion/`, `services/ingestion.py` | Incremental fingerprints; loaders for PDF, HTML, Markdown, TXT, DOCX, JATS/PubMed XML, JSON/JSONL/CSV; sidecar and manifest metadata; study-design classification; retractions; duplicates; structure-aware chunking |
| Retrieval | `backend/app/retrieval/` | Embeddings (multilingual-e5 / hashing / OpenAI-compatible); BM25 sparse vectors; local or Qdrant store; RRF fusion; cross-encoder or lexical rerank; quality prior; MMR with per-document cap; answerability |
| Evidence | `backend/app/evidence/` | Taxonomy; GRADE-inspired grading with caps and floor; claim verification (lexical, semantic, NLI); rationale in seven languages |
| Generation | `backend/app/llm/` | Versioned prompts; OpenAI-compatible provider (JSON schema, then JSON object, then text); extractive composer; optional model canary for a share of chat answers (`LLM_CANARY_*`) |
| Safety | `backend/app/safety/`, `resources/safety.yaml` | Multilingual input rules (crisis, emergency, urgent, boundaries); output rules; crisis lines by country; prompt-injection defence |
| Insights | `services/insights.py`, `resources/insight_topics.yaml` | 43 topics; anchor precision gate (with language-scoped anchors for Italian and Arabic); minimum sources; per-language generation; versioning; journeys taken from the taxonomy; clinical review records and optional review-before-publish drafts |
| Community | `backend/app/community/`, `resources/community.yaml` | Members (hashed keys); circles and weekly prompts; posts, replies and reactions; screening; reports; mutual blocking; moderation; strikes; appeals; "I felt supported" survey; anonymous event ledger for the quarterly transparency report (small counts suppressed); export and erasure; evidence links |
| Device sync | `services/device_sync.py`, `api/routes/sync.py`, `packages/shared/src/sync.ts` | Optional end-to-end-encrypted sync of plan and profile: the client derives id, write secret and key from a code (HKDF-SHA256) and encrypts with XChaCha20-Poly1305; the server stores ciphertext with a version (409 on a stale write; the client merges three ways and retries) |
| Jobs | `backend/app/workers/` | DB-backed jobs; inline thread pool or RQ; heartbeat, cancel and stale recovery; leader-elected scheduler (sync + daily retention) |
| Evaluation and fine-tuning data | `services/evaluation.py`, `services/sft_export.py` | Golden-set metrics; RAFT export with the production prompt |
| Model pipeline | `ml/` | Data checks, clinical review gate, QLoRA, merge, serving, release gates |
| Shared TS | `packages/shared/` | API client (SSE), types, typed i18n (7 languages, with reading direction), evidence and reference helpers, lifestyle check, plan, community helpers, sync, reminders, appointment questions, read-aloud text, offline packs, brand |
| Web | `web/` | Next.js App Router with `[lang]` routes; server-rendered evidence pages; streaming chat; PWA (manifest, service worker, offline page); right-to-left layout for Arabic (logical CSS); admin, moderation, appeals and clinical-review console |
| Mobile | `mobile/` | Expo Router tabs: Home, Ask, Insights, Community, Me; on-device storage; `expo/fetch` streaming; local notifications, speech, pedometer (all opt-in) |
| Deploy | `docker-compose.yml`, `deploy/k8s/`, `.github/workflows/ci.yml` | Images, Compose stack, Kubernetes (HPA, PDB, network policies, ingress for SSE), CI |

## Key flows

### Ask

1. The client sends `POST /api/v1/chat` with `messages`, `ui_language` and an optional `profile`.
2. Guardrails run. Emergency and crisis messages get a safety-only answer, and the stream ends.
3. Retrieval runs, then the answerability gate. Below the threshold the engine abstains with guidance.
4. The answer is generated (LLM or extractive) and streamed as `delta` events after `meta` and `evidence`.
5. Verification and grading run, and a `final` event carries the complete `ChatResponse`: citations with quotes,
   evidence assessment, verification and related insights.

### Insight build

Insights are rebuilt after every ingest that changes the library. For each topic and language:

1. Retrieve with the topic question and its queries.
2. Apply the anchor precision gate.
3. Check the minimum number of sources.
4. Generate with a JSON schema.
5. Verify each point; unsupported points are dropped.
6. Check the minimum sources again.
7. Grade and fingerprint.
8. Publish or mark as insufficient.

### Community post

1. Authenticate the member.
2. Check rate limits.
3. Detect the language.
4. Screen: reject, hold (with help for the author) or publish (with notes).
5. Match a published insight by anchors.
6. Store.
7. The feed shows published posts to members, plus the author's own held posts.

### Data link

1. `sources.yaml` or the console registers a URI.
2. The scheduler (or "Sync now") lists files through fsspec.
3. Fingerprints are diffed and changed files loaded.
4. Chunks are indexed in the vector store.
5. An insights job is chained.

## Scaling notes

- API and web pods are stateless; rate limits and the queue use Redis.
- The scheduler holds a database lease lock, so only one replica schedules.
- Jobs are de-duplicated by kind.
- Qdrant supports shards and replicas (`QDRANT_SHARDS`, `QDRANT_REPLICAS`).
- Insight and library responses carry ETags and can be cached at the CDN. Community and personal responses are
  `private, no-store`.
- The GPU model server scales independently. The extractive fallback keeps answers available when it is
  saturated or down.
