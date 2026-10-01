# `data/` — reserved corpus folder

This folder is **reserved for the knowledge corpus** that powers every answer and insight.
The AI engine is fully built and **waits for data**: until documents arrive, the API
reports `data_status: "awaiting_data"` and the web and mobile apps show the data
onboarding screen. When files appear (locally or in a linked bucket), the scheduler
picks them up automatically, indexes them, and generates evidence-graded insights.

> Raw files are git-ignored (licensing and size). Only the structure and these docs are versioned.

```
data/
├── sources.yaml          ← the link: which folders and buckets to ingest (local, s3://, gs://, az://, https://)
├── raw/                  ← drop documents here (or point sources.yaml to a bucket instead)
│   ├── research/         peer-reviewed articles: meta-analyses, RCTs, cohorts…  (PDF, JATS XML, JSONL)
│   ├── guidelines/       WHO / IARC / NCI / WCRF / ESMO / national guidelines
│   ├── web/              institutional patient-information pages (HTML, MD)
│   ├── blogs/            expert blogs (lowest evidence weight)
│   └── manifests/        optional metadata manifests (CSV / JSONL)
├── processed/            normalized text and chunk exports (generated)
├── index/                local vector and sparse index (generated when VECTOR_STORE=local)
├── eval/                 evaluation sets (golden questions → expected sources)
├── finetune/             supervised fine-tuning datasets exported for LLaMA (generated)
└── cache/                model and download caches (generated)
```

## Linking data: local folder or online bucket

Pick **one** of the following:

| Option | How |
|---|---|
| Drop files locally | Copy them into `data/raw/<category>/`. They are already registered in `sources.yaml`. |
| Point to another folder | Add `uri: /mnt/any/folder` or `uri: file:///mnt/any/folder` in `sources.yaml`. |
| S3 / MinIO / R2 | `uri: s3://bucket/prefix/` plus `storage_options` referencing `${AWS_ACCESS_KEY_ID}` and similar env vars. Install with `pip install ".[s3]"`. |
| Google Cloud Storage | `uri: gs://bucket/prefix/`. Install with `pip install ".[gcs]"`. |
| Azure Blob / ADLS | `uri: az://container/prefix/`. Install with `pip install ".[azure]"`. |
| HTTP(S) manifest | `uri: https://host/corpus/manifest.jsonl`: a JSONL whose lines contain `url` (to fetch) or `text` (inline). |
| One-liner | Set the env var `DATA_SOURCE_URI=s3://bucket/prefix` (adds a source with `source_type: auto`). |
| At runtime | Admin screen → *Data sources* → *Add source*, or `POST /api/v1/admin/sources`. |

Then use one of these:

- wait for the scheduler (`SYNC_INTERVAL_SECONDS`, default 300 s), or
- click **Sync now** in Admin, or
- run `make ingest` (`python -m app.cli ingest`).

Ingestion is **incremental**: files are fingerprinted (size, mtime/etag, and content SHA-256),
so unchanged files are skipped, changed files are re-indexed, and deleted files are removed from the index.

## Accepted formats

| Format | Notes |
|---|---|
| `.pdf` | Page numbers are preserved, so evidence can cite "p. 4". |
| `.html` / `.htm` | Boilerplate (nav, footer, scripts) is stripped. `<title>`, `citation_*` and `og:*` meta tags are read. |
| `.md` / `.txt` | Headings become section names. Optional YAML front-matter is read as metadata. |
| `.docx` | Heading styles become section names. |
| `.xml` | JATS (PMC) and PubMed XML: title, authors, journal, year, DOI, PMID, abstract and body are extracted. |
| `.json` / `.jsonl` | One record per object: `{"text": "...", "title": "...", ...metadata}`. Good for scraped pages and PubMed abstracts. |
| `.csv` | One record per row. Needs a `text` column (or `abstract`/`content`/`body`); other columns become metadata. |

## Metadata (strongly recommended: it drives evidence grading)

Metadata is resolved in this order (later wins):

1. the source `defaults` in `sources.yaml`
2. automatic extraction (DOI, PMID, year, title, study design from text)
3. a manifest file at the source root: `manifest.jsonl`, `_manifest.jsonl` or `manifest.csv`, keyed by `path`
4. a sidecar next to the file: `paper.pdf.meta.json` or `paper.pdf.meta.yaml`

| Field | Type | Example / allowed values |
|---|---|---|
| `title` | str | "Physical activity and cancer risk: an umbrella review" |
| `authors` | list[str] or "A; B" | `["Smith J", "Dupont M"]` |
| `year` / `published_date` | int / ISO date | `2021` / `2021-06-30` |
| `journal`, `publisher` | str | "The Lancet Oncology", "IARC" |
| `doi`, `pmid`, `pmcid`, `url` | str | `10.1000/xyz123`, `31234567` |
| `language` | ISO 639-1 | `en`, `fr`, `es`, `pt`, `de` |
| `source_type` | enum | `umbrella_review`, `meta_analysis`, `systematic_review`, `guideline`, `rct`, `cohort`, `case_control`, `cross_sectional`, `narrative_review`, `case_series`, `expert_opinion`, `institutional_web`, `blog`, `news`, `preclinical`, `auto` |
| `credibility` | enum | `authoritative`, `peer_reviewed`, `reputable`, `general`, `unverified` |
| `topics` | list[str] | `["physical_activity", "survivorship"]` |
| `cancer_types` | list[str] | `["breast", "colorectal"]` |
| `audience` | list[str] | `prevention`, `living_with_cancer`, `caregivers` |
| `sample_size` | int | `120000` |
| `license` | str | `CC-BY-4.0` |
| `retracted` | bool | `true` excludes the document from retrieval entirely |

Example sidecar `data/raw/research/moore2016.pdf.meta.yaml`:

```yaml
title: Association of Leisure-Time Physical Activity With Risk of 26 Types of Cancer in 1.44 Million Adults
authors: [Moore SC, Lee IM, Weiderpass E]
year: 2016
journal: JAMA Internal Medicine
doi: 10.1001/jamainternmed.2016.1548
source_type: cohort
credibility: peer_reviewed
topics: [physical_activity]
language: en
```

Example manifest line (`data/raw/research/manifest.jsonl`):

```json
{"path": "moore2016.pdf", "source_type": "cohort", "year": 2016, "doi": "10.1001/jamainternmed.2016.1548"}
```

## Evaluation sets (`data/eval/`)

`data/eval/*.jsonl` lines look like this:

```json
{"id": "q1", "question": "Does physical activity lower colon cancer risk?", "language": "en",
 "expected_documents": ["moore2016"], "expected_keywords": ["colon", "physical activity"], "must_refuse": false}
```

Run the set with `python -m app.cli evaluate`. It reports retrieval recall@k and MRR, citation
precision, groundedness, language fidelity and safety behaviour.

## Privacy and licensing

- Only ingest documents you have the right to use. The `license` field is surfaced in the source library.
- Do not place patient records or personal health information here. The corpus is for published knowledge only.
