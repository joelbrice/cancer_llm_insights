# Launch checklist

What is needed to launch Stepwell publicly in Germany and the EU. Part 1 is built and tested. Part 2 needs people:
accounts, money, signatures, clinical judgement or real users.

`python3 scripts/launch_check.py https://<your site>` checks everything software can verify on a running deployment.
Use `--staging` for staging. It must pass before launch.

## Part 1: done in the software

| Area | What exists | Where |
|---|---|---|
| Product | All features in BUILD_SPEC §4–§9 and the 1.1 / 1.2 / 2.0 roadmap, in 7 languages, on web, iOS and Android | `backend/`, `web/`, `mobile/` |
| Legal pages | Drafts of the privacy policy, terms, legal notice (Impressum) and accessibility statement in all 7 languages, written from what the code does. Shown on web and in the app, with the operator's details from `LEGAL_*` settings and a "draft" notice until `LEGAL_APPROVED=true` | `packages/shared/src/legal/`, `/{lang}/privacy` … |
| Security | Internal review with all findings fixed (rate-limit spoofing, request size, IP-free logs, CSP/HSTS, source locations); dependency audits and Dependabot; `security.txt` | `docs/SECURITY_REVIEW.md` |
| Production parity | Backend tests and the end-to-end suite run on PostgreSQL and Redis in CI. This found and fixed a bug that dropped documents on PostgreSQL | `.github/workflows/ci.yml` |
| Staging | Kubernetes overlay: own namespace, review-required insights, not indexed, nightly backups | `deploy/k8s/overlays/staging` |
| Backups | Nightly `pg_dump` and Qdrant snapshot (Kubernetes component); backup, restore and restore-drill scripts with checksums and optional encryption, tested on PostgreSQL 16 | `deploy/k8s/components/backup`, `scripts/backup/` |
| Load | Load test against the BUILD_SPEC §12 targets. Baseline: no errors; targets met with 20× headroom over the expected peak on one web process and one API worker | `scripts/loadtest/`, `docs/LOAD_TEST.md` |
| Stores | App Store and Google Play texts in 7 languages; draft privacy questionnaire answers; review notes; health-data declarations | `mobile/store.config.json`, `mobile/store/`, `docs/STORE_LISTING.md` |
| Accessibility | Automated WCAG 2.2 AA checks (axe) on every page in every language, phone and desktop | `web/e2e/a11y.spec.ts` |
| Licence | "Built with Llama" shown when the fine-tuned model answers | About page (web, mobile) |

## Part 2: needs people

Roughly in this order. Each item says who does it and how to tell it is done.

### A. Accounts and infrastructure (owner, engineer)

- [ ] **EU cloud.** A Kubernetes cluster in an EU region, with:
  - managed PostgreSQL with point-in-time recovery (RPO ≤ 15 min);
  - Redis and Qdrant;
  - an EU object storage bucket for the library and one for backups;
  - a GPU node for the model;
  - data processing agreements (DPAs) signed with each provider.
- [ ] **Domain and TLS.**
  - Register the domain, then point DNS at the ingress. cert-manager issues certificates.
  - Replace `app.stepwell.example` and `staging.stepwell.example` in:
    - `deploy/k8s/overlays/*`;
    - `mobile/eas.json`;
    - `mobile/store.config.json`.
- [ ] **Secrets.** Create `secrets.env` for each overlay, or use an external secret manager. Use a long random
  `ADMIN_API_KEY`.
- [ ] **Images.** Build and push the API and web images, then set the image tags in the overlays.
- [ ] **Restrict the admin console.** Put `/…/admin` and `/api/v1/admin` behind single sign-on or an IP allow-list
  at the ingress (recommended in `docs/SECURITY_REVIEW.md`).
- [ ] **Staging first.**
  1. Deploy staging.
  2. Run `scripts/launch_check.py --staging`.
  3. Run the load test with the real library and the GPU model, and record the results in `docs/LOAD_TEST.md`.
  4. Run a restore drill with `scripts/backup/drill.sh`.
- [ ] **Backups in production.** Once the staging drill passes, enable the backup component in the production
  overlay. Copy backups off-site.
- [ ] **Monitoring and on-call.**
  - Route Prometheus alerts (`deploy/monitoring/alerts.yaml`) to an on-call pager.
  - Add an external uptime check.
  - Keep logs for 30 days.
  - Name the on-call rota and rehearse the incident runbook (`docs/OPERATIONS.md`).

### B. Legal and regulatory (counsel, owner)

- [ ] **Legal texts.**
  1. Counsel reviews and adapts the drafts in `packages/shared/src/legal/`, in all languages; German is the
     reference version for a German operator.
  2. Fill in the `LEGAL_*` settings: operator, address, contact, register entry and VAT ID where they apply,
     responsible person under § 18 MStV, supervisory authority, hosting providers, accessibility enforcement body.
  3. Set `LEGAL_EFFECTIVE_DATE` and `LEGAL_APPROVED=true`.
- [ ] **Data protection officer.** Health data is processed as a core activity, so a DPO is probably required
  (Art. 37(1)(c) GDPR, § 38 BDSG). Appoint one and set `LEGAL_DPO_CONTACT`.
- [ ] **DPIA and records of processing.**
  - A data protection impact assessment (Art. 35) covering health data, the community, AI-generated answers and
    encrypted sync.
  - Records of processing (Art. 30), based on BUILD_SPEC §10.1.
- [ ] **Medical device qualification.** A regulatory memo confirming that Stepwell is not a medical device under
  MDR / MDCG 2019-11, for the intended purpose in BUILD_SPEC §10.4.
- [ ] **AI Act.** Confirm the transparency obligations (Art. 50) are met: answers say they are AI-generated, and
  insights are clinically reviewed.
- [ ] **Export compliance** for encrypted sync, before the first store build that includes it
  (`docs/STORE_LISTING.md`).
- [ ] **Trademark and domain.** Clearance search for "Stepwell" in the launch countries.
- [ ] **GitGuardian.** Mark incidents 38159876 and 38394508 as false positives, so the PR check turns green (see
  the PR comment).

### C. Library, clinical review and model (clinical lead, CSO, engineer)

- [ ] **Library.** Link the real evidence library (at least the frameworks in BUILD_SPEC §17) in the production
  buckets and let it ingest. Done when at least 80 % of topics publish in every language: count the `published`
  topics in `GET /api/v1/topics?lang=<language>`.
- [ ] **Insight sign-off.** Set `INSIGHT_REVIEW_REQUIRED=true` in production, then review and sign off every
  published insight in every language (admin console → "Clinical review of insights").
- [ ] **Safety rules and crisis lines.** Clinical review of the safety rules. Verify the crisis line for every
  launch country by calling it.
- [ ] **Native-speaker clinical review** of all 7 languages, especially Italian and Arabic, which were added last.
- [ ] **Model.**
  1. Export the fine-tuning data (RAFT) and have the dataset clinically reviewed.
  2. Train on a GPU and pin `base_model_revision`.
  3. Pass the release gates (`stepwell-ml evaluate`).
  4. Serve it with vLLM, using the canary for the first release.
- [ ] **Platform evaluation.** Add golden questions for each journey and language to `data/eval/`. Run the
  evaluation and meet the targets: safety 100 %, groundedness ≥ 0.95, abstention correctness ≥ 0.9.
- [ ] **Safety case.** The CSO signs the safety case report and the hazard log (BUILD_SPEC §8).

### D. Community (community lead)

- [ ] Recruit and train moderators, staff the rota for the hours you cover, and test the escalation path to the CSO
  (BUILD_SPEC §14.5).

### E. Security (owner, external tester)

- [ ] **Penetration test** on staging, using the scope in `docs/SECURITY_REVIEW.md`. Fix the findings and re-test.
- [ ] Turn on GitHub secret scanning and Dependabot alerts in the repository settings (`.github/dependabot.yml` is
  in place).

### F. Accessibility and usability (owner, specialists, participants)

- [ ] **Manual accessibility audit** by a specialist, on web and both apps with screen readers. Update the
  accessibility statement with the result.
- [ ] **Usability tests.** Five participants per journey per round, including people with low vision, older adults
  and people with limited health literacy, in German, English, French and Arabic at least.

### G. App stores (owner)

- [ ] **Accounts.** Apple Developer Program (organisation, D-U-N-S number) and Google Play Console (organisation,
  verified).
- [ ] **Builds and testing.** EAS project, signing credentials, preview builds on real iPhones and Android phones,
  then TestFlight and Play internal testing.
- [ ] **Store forms.**
  - Screenshots in 7 languages.
  - Upload the texts.
  - Privacy questionnaire, Data safety, health permissions declaration, age rating and review notes, all drafted
    in `docs/STORE_LISTING.md`.
- [ ] **Submit for review.**

### H. Go-live

- [ ] Review and merge PR #2, then tag the release.
- [ ] Deploy production, then confirm `scripts/launch_check.py https://<site>` passes.
- [ ] Watch error rates, latency and moderation queues closely for the first week (BUILD_SPEC §7.3).

### I. After launch

- [ ] Publish the first quarterly transparency report (automatic; check it).
- [ ] Run a monthly restore drill and record it.
- [ ] Review dependency updates weekly; repeat the penetration test yearly.
- [ ] Research partnerships to evaluate outcomes (roadmap 2.0): partners, a protocol and ethics approval.
