# Data protection impact assessment (Art. 35 GDPR): DRAFT

> **Status: draft for the data protection officer and counsel.**
>
> - **Source:** prepared from the software as built (BUILD_SPEC §10.1 and the code), October 2026.
> - **Owner's role:** confirm the facts, add the organisational measures, decide on the residual risks and sign.
> - **Updates:** revise this assessment whenever a processing activity changes (BUILD_SPEC §10.1 is the source of
>   truth for the data inventory).

## 1. Why a DPIA is required

Stepwell processes data concerning health (Art. 9 GDPR) of potentially many people, including people with cancer
and their carers, and offers a moderated peer-support community. This matches several criteria for mandatory
assessment:

- sensitive data processed at scale;
- vulnerable data subjects;
- innovative technology (AI-generated answers).

These criteria come from the EDPB guidelines on DPIA (WP248) and from the German supervisory authorities' list of
processing operations that require a DPIA.

## 2. Description of the processing (Art. 35(7)(a))

**Controller:** the operator named in the `LEGAL_*` settings.

**Purpose:** general, evidence-based health education and peer support about lifestyle and cancer.

**Data subjects:**

- visitors and app users;
- community members;
- operator staff: moderators, clinical reviewers, administrators.

| Processing | Data | Where | Retention | Legal basis |
|---|---|---|---|---|
| P1 Answering a question | Question text, earlier messages of the conversation, profile fields the person chose to share (journey, age range, sex, cancer types, treatment phase, country) | Server memory only; not stored (`STORE_CONVERSATIONS=false`) | Duration of the request | Art. 6(1)(b); Art. 9(2)(a) for health details |
| P2 Insights and library | Published research; no personal data | Server | — | — |
| P3 Feedback | Rating, reasons, optional comment, with personal details removed automatically; no identifier | Server (PostgreSQL) | 12 months | Art. 6(1)(f) |
| P4 Community membership | Nickname, language, optional journey badge, SHA-256 of the access key, strikes and status | Server | Until the member leaves | Art. 9(2)(a), explicit consent at joining |
| P5 Community content | Posts, replies, reactions, reports, blocks, appeals; may reveal health | Server; visible to members only; never indexed | Until deleted; removed posts 90 days | Art. 9(2)(a) |
| P6 Moderation | Moderator decisions on P5, plus an anonymous event ledger (no member, post or text) for the transparency report | Server | Ledger kept for the report | Art. 6(1)(f) (safety); the ledger holds no personal data |
| P7 "Did you feel supported?" | Answer, linked to the member until they leave | Server | 12 months | Art. 9(2)(a) |
| P8 Encrypted sync | Ciphertext of plan and profile, version, SHA-256 of a write secret; no identity | Server; unreadable by the operator | Until turned off; at most 400 days after the last change | Art. 9(2)(a) |
| P9 Security and operations | IP address held in memory for rate limiting (minutes); request log with time, route, status and duration, without IP or content | Server | Logs 30 days | Art. 6(1)(f) |
| P10 On-device data | Profile, plan, check-ins, lifestyle check, appointment questions, reminders, conversation, step counts (motion sensor, Apple Health, Health Connect), offline packs | User's device only | Until the user deletes it | Not processed by the operator |
| P11 Contact by email | Messages people send to the contact address (rights requests, accessibility feedback) | Operator's mailbox | **Operator to define** | Art. 6(1)(c) / (f) |

**Recipients:**

- hosting and infrastructure processors (EU/EEA), under Art. 28 agreements;
- community members can read each other's posts.

The language model is self-hosted, so no third-party AI provider receives questions. There is no advertising,
analytics or tracking SDK in the web app or the mobile apps.

**Technology:** FastAPI engine; PostgreSQL, Redis and Qdrant; a self-hosted Llama model fine-tuned on retrieval
tasks; a Next.js web app; Expo iOS and Android apps. See `docs/ARCHITECTURE.md`.

## 3. Necessity and proportionality (Art. 35(7)(b))

- **Data minimisation by design.** Health details stay on the device unless the person chooses a feature that needs
  the server. Questions are not stored.
  - The community needs no name, email or phone number.
  - Sync is end-to-end encrypted, so the operator cannot read it.
- **Purpose limitation.** No secondary use: no advertising, profiling, sale or model training on user data. The
  fine-tuning data is built from the research library, not from user questions.
- **Storage limitation.**
  - Retention periods are enforced by scheduled purges: feedback 12 months, removed posts 90 days, sync 400 days.
  - Logs carry no client addresses.
- **Consent quality:**
  - the community asks for explicit consent with a separate checkbox;
  - sync and the health-store switch are separate opt-ins;
  - all of these can be withdrawn in the app.
- **Transparency:** a privacy policy in seven languages, a first-launch notice, a public transparency report and
  in-context explanations.
- **Data subject rights in the app:**
  - community download (Art. 15/20) and deletion (Art. 17);
  - turning sync off deletes the server copy;
  - "Delete my data from this device".

  The operator cannot identify people, which is privacy-protective; Art. 11 applies.

## 4. Risks to the rights and freedoms of data subjects (Art. 35(7)(c))

Likelihood and severity before (inherent) and after (residual) the measures in section 5. Scale: low, medium, high.

| # | Risk | Inherent | Main measures (section 5) | Residual |
|---|---|---|---|---|
| R1 | A community member is identified from posts, revealing a cancer diagnosis to others (employer, family) | Medium / High | M1, M2, M3, M5 | Low / High → **Medium**: depends on what members share; guidelines and screening reduce but cannot remove it |
| R2 | Breach of server data (community, feedback) | Medium / High | M6, M7, M8, M9 | Low |
| R3 | Health information inferred from questions or logs | Medium / High | M10, M11 | Low |
| R4 | Sync data disclosed | Low / High | M12 | Low (ciphertext only) |
| R5 | Minors join the community | Medium / Medium | M4 | Medium: self-declaration only |
| R6 | A person in crisis is not helped in time | Medium / Very high | M13 | Medium; tracked as clinical hazard H1 |
| R7 | Inaccurate AI information leads to harmful decisions | Medium / High | M14 | Low–medium; hazards H3, H6 and H14 |
| R8 | Moderators misuse access to posts | Low / High | M15 | Low |
| R9 | Rights requests cannot be fulfilled because people are not identifiable | Medium / Low | M16 | Low |
| R10 | Transfer outside the EU/EEA | Medium / Medium | M17 | Low, once hosting contracts confirm EU processing |
| R11 | Data on a lost or shared device is read by someone else | Medium / Medium | M18 | Medium: depends on the device lock |

## 5. Measures (Art. 35(7)(d))

| # | Measure | Where implemented |
|---|---|---|
| M1 | Pseudonymous membership; nicknames screened for real names, contact details and impersonation | `backend/app/community` |
| M2 | Screening before display: contact details, untrusted links, identifying details; members can report and block | `backend/app/resources/community.yaml` |
| M3 | Members-only reading, `noindex`/`no-store` headers, no private messages | `backend/app/main.py`, `web/next.config.ts` |
| M4 | Age confirmation (18+) at joining; minors are a removal reason in the guidelines | Community join flow |
| M5 | Leaving deletes membership and words; removed posts purged after 90 days | `CommunityService.erase`, retention jobs |
| M6 | TLS everywhere, with HSTS and a content security policy; hashed tokens; constant-time admin key check | `docs/SECURITY_REVIEW.md` |
| M7 | Hardened containers, network policies, Pod Security `restricted`, secrets outside the code | `deploy/k8s` |
| M8 | Encrypted backups (age), restore drills, EU object storage | `scripts/backup`, `docs/OPERATIONS.md` |
| M9 | Penetration test before launch and yearly; dependency audits in CI | `docs/LAUNCH.md` |
| M10 | Questions processed in memory only; no conversation storage by default | `STORE_CONVERSATIONS=false` |
| M11 | No client IP addresses or request content in logs | `backend/app/main.py`, `cli.py` |
| M12 | End-to-end encryption (XChaCha20-Poly1305, HKDF-SHA256); no account or identifier; deletion | `packages/shared/src/sync.ts` |
| M13 | Multilingual crisis detection, crisis lines by country, held posts with immediate help, staffed moderation targets | BUILD_SPEC §8, §9.4 |
| M14 | Retrieval-only answers, claim verification, abstention, evidence grades, clinical sign-off of insights, disclaimers | BUILD_SPEC §5, §7 |
| M15 | Need-to-know access to the admin console (key; recommended SSO/IP allow-list), confidentiality agreements, training, decisions recorded | `docs/LAUNCH.md`, **operator** |
| M16 | Rights exercised in the app (download, delete, sync off); proof of ownership via the community download | App; privacy policy |
| M17 | EU hosting; self-hosted model; Art. 28 agreements with every processor | **Operator** (`docs/LAUNCH.md` §A) |
| M18 | Local data deletable at any time; operating-system sandbox and device encryption | App |

**Recommended before launch (operator decision):**

1. **Device storage of keys.** Keep the community access key and the sync code in the mobile operating system's
   secure storage (Keychain or Keystore, via `expo-secure-store`). They are currently in app storage. This lowers
   R11 for the two secrets that allow access from another device.
2. **Admin access.** Put the admin console behind single sign-on, so moderator and reviewer actions are tied to
   named accounts (R8).
3. **Mailbox retention.** Define retention for the contact mailbox (P11).

## 6. Consultation and sign-off

- [ ] Data protection officer's opinion (Art. 35(2)).
- [ ] Views of data subjects or their representatives, where appropriate (Art. 35(9)), for example a patient
  organisation reviewing the community guidelines and privacy texts.
- [ ] Decision on the residual risks. If high residual risks remain, consult the supervisory authority before
  processing (Art. 36).
- [ ] Date, names and signatures; review date (at least yearly and on every change to the processing).
