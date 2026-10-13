<p align="center"><img src="web/public/icon.svg" width="72" alt=""></p>

# Stepwell — Cancer prevention & support

**Small steps, backed by research.** Stepwell helps people **lower their risk of cancer**, **get through
treatment** and **live well afterwards**, and supports **the people who care for them**:

- Every answer and insight comes from a curated library of research and guidelines.
- Every statement is **linked to the exact passage it comes from**.
- Every answer carries an **honest grade of how strong the evidence is**.
- A small, moderated **community** lets people encourage each other.

It is written for individuals and families, not professionals. It works in English, French, Spanish, Portuguese,
German, Italian and Arabic (right to left), on the web (installable PWA), iOS and Android.

> **Use with caution.** Stepwell provides educational information. It is not a medical device, does not diagnose,
> and does not replace a care team. In an emergency, call your local emergency number.

## What's inside

| | |
|---|---|
| **Ask** | Streaming answers grounded in the library, with tappable citations, quoted passages, an evidence grade, statement-by-statement verification and safety guidance first. When the evidence is insufficient, it says so. |
| **Insights** | 43 topics across four journeys, generated per language: key points, "what you can do", limits of the evidence, study-design profile and full references. |
| **Evidence library** | Every source with its study design, credibility and year, and the insights that cite it. Retracted papers are never used. |
| **Lifestyle check** | 15 questions compared with WHO, WCRF and the European Code Against Cancer. Private on the device. **Not** a risk score. |
| **My plan** | Evidence-based steps with weekly check-ins and streaks; milestones can be shared with the community. Optional weekly reminder, and on mobile a step count that never leaves the phone. |
| **Personal tools** | Read-aloud of insights; a "questions for your appointment" list to print; offline insight packs on mobile; optional **end-to-end-encrypted sync** of plan and profile between devices (the server cannot read it). |
| **Community** | Four circles with weekly prompts; wins, tips and encouragement; supportive reactions only; no private messages. Every post is screened, and posts link to "what the research says". Authors can appeal decisions; a public quarterly transparency report shows aggregate moderation numbers. |
| **AI engine** | Hybrid retrieval, reranking, a Llama model fine-tuned for grounded answers (or an extractive fallback), claim verification, GRADE-inspired grading, multilingual safety. |
| **Data link** | Drop files in `data/raw/`, or link S3, GCS, Azure or HTTPS buckets. Sync is incremental and automatic. |

The platform runs fully **before any data is connected**, showing the "awaiting data" state, and fills itself as
soon as documents are linked.

## Repository

```
backend/          FastAPI engine: ingestion, retrieval, grading, verification, safety, insights, community, jobs
web/              Next.js 16 PWA (7 languages incl. right-to-left, mobile-first, dark mode, offline)
mobile/           Expo SDK 57 app (iOS, Android, web)
packages/shared/  TypeScript client, types, i18n, evidence/lifestyle/plan/community logic shared by web + mobile
ml/               Llama fine-tuning: RAFT data checks, clinical review gate, QLoRA, serving, release gates
data/             The reserved evidence folder + sources.yaml (the link to local data or online buckets)
deploy/k8s/       Kubernetes (kustomize): API, workers, web, HPA, PDB, network policies, ingress
deploy/monitoring/ Prometheus alert rules (safety, answer quality, service health)
docs/             BUILD_SPEC.md · ARCHITECTURE.md · OPERATIONS.md
```

## Quick start (development)

```bash
# engine
python -m venv .venv && . .venv/bin/activate
pip install -e "backend[dev]"
cd backend && cancer-insights serve --reload            # http://localhost:8000/docs

# web + mobile (Node 22, pnpm 10)
pnpm install
pnpm --filter @stepwell/web dev                         # http://localhost:3000
pnpm --filter @stepwell/mobile start                    # Expo (press i / a / w)
```

Then add documents to `data/raw/…` (see `data/README.md`) and open **/en/admin → Sync now**.

## Full stack

```bash
cp .env.example .env && docker compose up -d --build    # Postgres, Redis, Qdrant, API, worker, web
docker compose --profile llm up -d                      # + vLLM serving the fine-tuned Llama (GPU)
```

Kubernetes: `kubectl apply -k deploy/k8s/overlays/production` (see `docs/OPERATIONS.md`).

## Quality

```bash
make test        # engine, model pipeline and shared-package tests
make typecheck   # shared, web, mobile
make e2e         # Playwright journeys + axe (WCAG 2.2 AA) on every page in every language, phone and desktop
```

CI runs all of these, the web production build, a Metro bundle of the mobile app, and both container builds.

## Documentation

- [Build specification](docs/BUILD_SPEC.md): product, journeys, evidence framework, AI, clinical safety (hazard
  log), community governance, privacy and regulation, accessibility, NFRs, launch criteria.
- [Architecture](docs/ARCHITECTURE.md) · [Operations](docs/OPERATIONS.md) · [Data folder](data/README.md) ·
  [Model pipeline](ml/README.md) · [Mobile](mobile/README.md)

## Licence

MIT for the code. Fine-tuned weights derived from Meta Llama follow the Llama Community License ("Built with
Llama").
