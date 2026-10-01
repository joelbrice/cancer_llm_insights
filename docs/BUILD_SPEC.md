# Stepwell — Build Specification

**Cancer prevention & support, backed by research**

| | |
|---|---|
| Document | Build specification v1.0 |
| Date | 1 October 2026 |
| Status | Draft for clinical, privacy and regulatory review |
| Product owner | (to be named) |
| Clinical lead / Clinical safety officer (CSO) | (to be named; registered clinician with oncology or public-health experience) |
| Community lead | (to be named) |
| Data protection officer | (to be named) |
| Code | `joelbrice/cancer_llm_insights` (monorepo: `backend/`, `web/`, `mobile/`, `packages/shared/`, `ml/`, `data/`, `deploy/`) |

---

## 1. Vision and positioning

### 1.1 Purpose

Stepwell helps **individuals and families** in three situations:

- **Lower their risk of cancer** through everyday choices about tobacco, alcohol, food, activity, weight, sun,
  vaccination and screening.
- **Get through treatment** by looking after energy, eating, side effects, sleep and emotions.
- **Recover and live well afterwards** by rebuilding strength and habits, returning to work, and coping with the
  fear of recurrence.

It also supports **the people who care for them**.

Everything Stepwell says comes from a curated library of research, guidelines and reputable sources:

- Every statement is **linked to the passage it comes from**.
- Every answer carries an **honest grade of how strong the evidence is**.
- A small, moderated **community** lets people encourage each other.

### 1.2 Principles

1. **Evidence before everything.** Stepwell makes no claim without a source. When the library holds too little
   evidence, it says so rather than guess.
2. **For people, not professionals.** Plain language at a reading age of about 12, a warm tone, no jargon without
   explanation, and five languages (English, French, Spanish, Portuguese, German). Health professionals are not
   the audience. The product avoids clinical decision-support features entirely (see §10.4).
3. **Never blame.** Risk factors change probabilities, not certainties, and many cancers occur without any
   lifestyle cause. No copy, insight or community post may imply that someone caused their illness.
4. **Safety first.** Emergencies, crisis and urgent symptoms during treatment are recognised in every language and
   answered with help before anything else. Stepwell never diagnoses, interprets symptoms or advises on starting,
   stopping or dosing a treatment.
5. **Private by design.** No account is needed to read, ask or plan. The profile, plan and lifestyle check stay on
   the device. The community is pseudonymous and members-only. There are no ads, trackers or data sales.
6. **Encouragement over engagement.** Success means healthier habits and people feeling supported, not time spent
   in the app. Stepwell uses no dark patterns, infinite feeds or streak shaming.

### 1.3 What Stepwell is not

- It is not a medical device, symptom checker or diagnostic tool, and it does not calculate personal cancer risk
  (see §6.4 and §10.4).
- It does not replace a care team or offer telemedicine.
- It has no private messaging, marketplace or fundraising.

---

## 2. Name and brand

### 2.1 Name: **Stepwell**

A *stepwell* is a centuries-old public well: people walk down steps to reach water, and it is also a place to
gather. The name carries three ideas at once:

| Meaning | Where it shows up |
|---|---|
| **Small steps** towards better health (prevention) | Lifestyle check, insights and *My plan* with weekly check-ins |
| **Step-by-step support** through treatment and recovery | Journeys for people going through treatment and for life after treatment |
| **A place to gather** and be encouraged | The community's circles, weekly prompts and supportive reactions |

The full name in stores and page titles is **"Stepwell — Cancer prevention & support"**. The descriptor makes the
purpose explicit.

The **home-screen label is just "Stepwell"**, so the word "cancer" never appears on someone's phone. Many
people affected by cancer do not want that visible to others.

Before launch the name needs trademark clearance (EUIPO, UKIPO, USPTO, INPI, and the app stores) and domain
checks. The brand is configurable without code changes (`NEXT_PUBLIC_APP_NAME`, `EXPO_PUBLIC_APP_NAME`,
`APP_NAME`; `packages/shared/src/brand.ts`).

### 2.2 Identity

- **Mark:** steps rising towards a sun. It is drawn as a vector (`web/public/icon.svg`); PWA, Apple and
  Android icons are generated from it.
- **Colours:** brand teal `#0f6e64` (dark mode `#43b8a7`) on warm neutral surfaces.
  - Evidence strength uses a **single blue ordinal ramp**, separate from the brand colour so grades never look
    like marketing.
  - All text and interface contrast meets WCAG 2.2 AA in light and dark modes.
- **Tagline:** "Small steps, backed by research".
- **Tone of voice:** warm, calm, honest, specific. Prefer "you can" to "you must" and "is linked to" to
  "causes" when the evidence is observational. Give absolute numbers when available. Never use fear appeals.

---

## 3. People and journeys

Stepwell is organised around four **journeys**. Every topic, insight, community circle and profile uses the same
values: `prevention`, `in_treatment`, `after_treatment`, `caregivers`.

| Journey | Persona (illustrative) | Needs | What Stepwell offers |
|---|---|---|---|
| **Lower my risk** | *Amara, 42*. Her mother had breast cancer. She feels overwhelmed by contradictory headlines. | Clear, trustworthy guidance and realistic first steps. | Insights graded by evidence, the lifestyle check, *My plan*, screening and vaccination information, and the "Healthy habits" circle. |
| **Going through treatment** | *Daniel, 58*, in chemotherapy for colorectal cancer. He is exhausted and unsure whether exercise is safe. | Safe, practical help for fatigue, eating, nausea, sleep and worry, and clarity on when to call the care team. | Insights on exercise during treatment, nutrition, fatigue and supplements, urgent-symptom guidance, and the "Through treatment" circle. |
| **Recovering & life after cancer** | *Sofia, 36*, a year after breast-cancer treatment. Fear of recurrence; back at work part-time. | Rebuilding energy and confidence, lowering her risk of recurrence through lifestyle where evidence supports it, and coping with worry. | Insights on exercise and weight after diagnosis, alcohol, return to work, cognitive changes and fear of recurrence, plan streaks, and the "Life after treatment" circle. |
| **Supporting someone** | *Lucas, 50*, caring for his mother. He is tired and feels guilty taking time for himself. | Practical help, permission to rest, and somewhere to talk to others. | Insights on caregiver wellbeing and nutrition support, plus the "Family & caregivers" circle. |

Inclusion requirements:

- The journeys are self-selected and optional. People can change them, and the profile never asks for a diagnosis.
- Copy is gender-inclusive in French (for example *seul·e*). Spanish uses the informal *tú*, Portuguese uses
  European Portuguese, and German uses the formal *Sie*. Each language matches the convention of trusted national
  health information in that language.

---

## 4. Product scope (v1.0)

| Area | Web (PWA) | iOS / Android | Acceptance criteria (summary) |
|---|---|---|---|
| **Home** | ✓ | ✓ | Status of the evidence library; ask box; four journey cards; featured insights; community and check invitations. |
| **Ask** (streaming chat) | ✓ | ✓ | See below. |
| **Insights** | ✓ | ✓ | See below. |
| **Evidence library** | ✓ | ✓ | Every citable document with its study design (and how it was detected), credibility, year, abstract, indexed passages and the insights that cite it. Retracted documents are flagged and never used. |
| **How we grade evidence** | ✓ | ✓ | The evidence pyramid, the grades, the safeguards (caps), verification, abstention and safety, in plain language. |
| **Lifestyle check** | ✓ | ✓ | Fifteen questions mapped to international recommendations (§6.4). Computed on the device; explicitly *not* a risk score; each result links to the evidence. |
| **My plan** | ✓ | ✓ | Recommendations added from insights; weekly check-ins; streak count; milestones shareable to the community; stored only on the device. |
| **Community** | ✓ | ✓ | §9. |
| **Profile** | ✓ | ✓ | Journey, age range, sex, cancer types, treatment phase and country (for helplines). Only on the device; sent with questions to tailor relevance; never stored on the server. |
| **Settings** | ✓ | ✓ | Language (5), theme (system / light / dark), on mobile the API endpoint, and delete all local data. |
| **Data & admin** (operators) | ✓ | — | See below. |
| **Offline** | ✓ (service worker) | partial | Previously visited pages and the plan work offline; an offline page explains what is unavailable. |

**Ask (streaming chat):**

- The first words appear in under 2.5 s (p95) with a GPU-served model, or under 0.8 s in extractive mode.
- Every factual sentence carries a citation chip that opens the exact quoted passage and its source.
- The answer shows its evidence grade with a plain-language rationale and the percentage of statements verified.
  Unverified statements are visibly marked.
- Safety guidance appears before the answer. When the evidence is insufficient, the answer abstains honestly.
- The answer links to related insights and offers feedback buttons.

**Insights:**

- Filter by topic and journey, and search.
- Each insight shows key points and "what you can do" with citations, plus the limits of the evidence.
- Each insight shows an evidence profile: grade, rationale, study-design bars and publication years.
- Each insight lists references with quotes, and offers *add to plan*, share and a follow-up question.

**Data & admin (operators):**

- Link local folders or buckets (S3, GCS, Azure, HTTPS manifest) and test the connection.
- Sync, re-index, rebuild insights, run evaluations and export fine-tuning data.
- Follow jobs, quality statistics and the community moderation queue. Protected by `ADMIN_API_KEY`.

**Out of scope for v1.0:**

- Private messages, public profiles and follower graphs.
- Clinician-facing features.
- Personal risk prediction.
- Wearable integrations.
- Push notifications (planned for v1.1 as opt-in).
- Payments.

---

## 5. Evidence and content framework

### 5.1 The library

The library is linked rather than uploaded:

- `data/sources.yaml`, or the admin console, declares local folders or online buckets.
- The engine indexes them **incrementally**, using fingerprints and sidecar metadata, and syncs every
  `SYNC_INTERVAL_SECONDS`.

The source classes are:

| Source class | Examples | Default credibility |
|---|---|---|
| Guidelines and agency reports | WHO and IARC, national cancer institutes, NICE, ESMO and ASCO guidance, national health services | authoritative |
| Peer-reviewed research | Umbrella reviews, meta-analyses, systematic reviews, trials, cohort and case-control studies | peer_reviewed |
| Institutional web | Cancer charities, university hospitals | reputable |
| Blogs and news | Only to explain context. Capped at *Very low*. | general |

Ingestion handles the following:

- **Retractions:** a document marked `retracted` is excluded entirely.
- **Duplicates:** same content hash or DOI.
- **Study design:** classified in this order of precedence — metadata, then PubMed/JATS publication type, then
  source default, then multilingual text heuristics. The basis is shown to users ("Design detected from PubMed
  publication type").

### 5.2 Topic taxonomy

There are 43 topics (`backend/app/resources/insight_topics.yaml`), each with a question in five languages,
retrieval queries, editorial guidance and **anchor terms**. A passage counts as evidence for a topic only if it
mentions every anchor group (a precision gate).

| Journey | Categories (examples of topics) |
|---|---|
| Prevention | Tobacco (smoking, quitting, second-hand smoke, e-cigarettes) · alcohol · body weight · physical activity and sitting · nutrition (processed and red meat, plant foods and fibre, sugary drinks and ultra-processed foods, supplements) · sun and sunbeds · infections and vaccination (HPV, hepatitis B/C, *H. pylori*) · screening and family history · hormones (breastfeeding, menopausal hormone therapy) · environment (radon, air pollution, occupational exposures) · night shifts and stress |
| In treatment | Exercise during treatment · nutrition during treatment · fatigue · nausea and appetite · sleep · supplements during treatment · integrative therapies · smoking after diagnosis · lymphoedema · memory and concentration ("chemo brain") · anxiety and low mood · peer support |
| After treatment | Exercise after treatment · weight and alcohol after diagnosis · return to work · fear of recurrence · cognitive changes · diet myths |
| Caregivers | Caregiver wellbeing · nutrition support · anxiety and low mood · peer support |

Framework alignment (see §17) includes:

- the European Code Against Cancer (IARC);
- the WCRF/AICR Cancer Prevention Recommendations;
- the WHO guidelines on physical activity and sedentary behaviour;
- the ACS guideline on diet and physical activity for cancer survivors;
- the ASCO guideline on exercise, diet and weight management during treatment;
- the ACSM roundtable on exercise for cancer survivors;
- SIO–ASCO integrative oncology guidance.

**The frameworks shape the questions, not the answers. Every statement must be cited from the library.**

Changes to topics, anchors or guidance are owned by the clinical lead, made by pull request and recorded in the
change log.

### 5.3 Grading (GRADE-inspired, transparent)

Each source gets a quality score: **study-design weight × credibility × recency**. The score is then adjusted by
how strongly the cited passage supports the statement.

**Base score.** If *e* is a source's support-weighted quality, the grade score is:

  `score = 0.65 · max(e) + 0.35 · (1 − Π(1 − 0.6·e))`

This combines the single strongest source with the number of independent sources that agree.

**Penalties (× 0.85):**

- only one source;
- mixed findings, where one source reports an effect and another reports none.

**Caps:**

| Evidence base | Grade cannot exceed |
|---|---|
| Only blogs or news | *Very low* |
| No human studies (laboratory or animal only) | *Low* |
| No systematic review, trial or guideline | *Moderate* |

**Floor:** two or more concordant top-tier sources (systematic review, meta-analysis or guideline) give at least
*Moderate*.

**Levels:** High ≥ 0.75 · Moderate ≥ 0.55 · Low ≥ 0.35 · Very low below that · *Insufficient* when nothing
relevant is found.

A rationale is generated in the reader's language, for example "Based on 3 independent sources · strongest
source: meta-analysis (2022) · sources agree".

### 5.4 Verification and abstention

Every generated sentence is checked against the passage it cites, using:

- lexical overlap and semantic similarity;
- optionally, natural language inference (NLI) — a model that tests whether the passage entails the sentence.

A number that does not appear in the source makes the claim **unsupported**. Unsupported claims are:

- **removed** from published insights;
- **visibly flagged** in chat answers.

An insight is published only if, after verification, it still has at least `INSIGHT_MIN_SOURCES` (default 2)
independent sources.

**Answerability** is computed as follows, and Stepwell abstains below a threshold of 0.56:

  `answerability = (0.5 × best relevance + 0.5 × query coverage) × (1 − 0.6 × missing-term share)`

When it abstains, it tells the person who can help.

### 5.5 Editorial lifecycle

Insights are versioned and fingerprinted. They are rebuilt when their evidence changes and carry a status:
*published*, *insufficient evidence* or *needs review*.

The clinical lead reviews:

- every new insight in each language before first publication (staged in a non-production environment);
- a random 10 % sample each month.

Users' feedback ("not helpful", plus a reason) is triaged weekly.

---

## 6. Personal tools

### 6.1 Profile

The profile is **optional** and stored only on the device. It holds:

- journey, age range and sex;
- cancer type(s) and treatment phase, as free text;
- country, two letters, used only to choose helplines.

It is sent with a question purely to tailor relevance and is never logged, because `STORE_CONVERSATIONS=false` by
default and the API never persists profiles.

### 6.2 My plan

People add "what you can do" items from insights. Each week a person can tick an item as done; the number of
consecutive weeks is shown as a streak. Missed weeks are never shamed.

Milestones can be **shared to the community** with one tap as a *Plan milestone* post.

### 6.3 Reminders (v1.1)

Reminders will be opt-in local notifications, for example "Sunday evening: how did your plan go?". They will
run on the device only, with no server push in v1.1.

### 6.4 Lifestyle check — thresholds (clinical-lead controlled)

The check is computed **only on the device** and is explicitly **not a cancer risk score**. The interface says so
on every result. For each answer:

- the status is *in line* / *partly* / *room to improve* / *worth discussing*;
- the advice is supportive and practical;
- the framework it comes from is shown;
- there is a link to the corresponding evidence-graded insight.

| Item | Framework | In line | Partly | Room to improve | Worth discussing |
|---|---|---|---|---|---|
| Tobacco | ECAC | never / stopped | — | occasionally, daily | — |
| Second-hand smoke | ECAC | no | sometimes | often | — |
| Alcohol (drinks/week) | WCRF | none | 1–7 | ≥ 8 | — |
| Moderate activity (min/week) | WHO 2020 | ≥ 150 | 60–149 | < 60 | — |
| Sitting (h/day) | WHO 2020 | < 6 | 6–8 | > 8 | — |
| Body weight (BMI, computed locally) | WCRF | 18.5–24.9 | 25–29.9 | ≥ 30 | < 18.5, unknown |
| Vegetables and fruit (portions/day) | WCRF | ≥ 5 | 3–4 | 0–2 | — |
| Whole grains and pulses | WCRF | most days | some days | rarely | — |
| Processed meat | WCRF | rarely | 1–2/week | ≥ 3/week | — |
| Red meat (portions/week) | WCRF | 0–3 | 4–6 | ≥ 7 | — |
| Sugary drinks | WCRF | rarely | few/week | daily | — |
| Sun protection and sunbeds | ECAC | protects, never sunbeds | sometimes | rarely or sunbeds | — |
| Supplements to prevent cancer | WCRF | no / prescribed | own initiative | — | — |
| HPV / hepatitis B vaccination | ECAC | yes | — | — | no / not sure |
| Screening up to date | ECAC | yes | no | — | not sure / not eligible |

Points to note:

- The thresholds are simplified for self-assessment and cite their framework. Any change requires clinical-lead
  approval and a hazard-log review (§8).
- Underweight, vaccination and screening answers are *worth discussing* rather than graded. They are prompts to
  talk with a clinician.
- Alcohol: WCRF advises that, for cancer prevention, it is best not to drink alcohol, so any drinking is at most
  *partly* in line.

---

## 7. AI system specification

### 7.1 Pipeline

```
question ─▶ safety guardrails (5 languages) ─▶ standalone-question rewrite (multi-turn)
         ─▶ hybrid retrieval: dense (multilingual-e5) + BM25 sparse ─▶ reciprocal-rank fusion
         ─▶ rerank (cross-encoder or IDF-weighted coverage) + quality prior + MMR diversity (≤ N passages per document)
         ─▶ answerability gate ─▶ generation (fine-tuned Llama via vLLM, JSON-schema for insights) or extractive composer
         ─▶ claim-level verification ─▶ evidence grading ─▶ streamed answer + citations + grade + related insights
```

**Prompts:**

- They are versioned (`PROMPT_VERSION`) and the same text is used in fine-tuning.
- Retrieved text is treated as data: instruction-like content is neutralised to prevent indirect prompt
  injection.

**Languages:** answers are written in the user's language even when the sources are in another. The answer then
notes that the sources are in another language.

**Fallback:** if the model server is unavailable, the **extractive composer** builds answers from verbatim
sentences of the sources. Grounding is therefore 100 % by construction, and service continues.

### 7.2 Model

| | |
|---|---|
| Default | Llama 3.1 8B Instruct + QLoRA adapter (`ml/configs/llama31-8b-qlora.yaml`), served by vLLM with LoRA |
| Alternatives | Llama 3.2 3B (low cost / edge), Llama 3.3 70B (highest quality), GGUF via Ollama / llama.cpp for CPU |
| Training data | RAFT export from the platform (grounded with distractors · abstention · safety), only after clinical sign-off bound to the file's SHA-256 |
| Release gates | Citation validity ≥ 0.98 · citation coverage ≥ 0.85 · answers with unsupported numbers ≤ 2 % · abstention ≥ 0.90 · safety = 1.00 · language fidelity ≥ 0.95 · no regression > 0.02 against the current model. Gates fail closed. |
| Promotion | All gates pass **and** the platform evaluation is at least as good as the current model **and** the CSO signs the report (§8). A canary at 10 % of traffic for 48 h precedes full rollout. |
| Licence | Llama Community License and Acceptable Use Policy; "Built with Llama" attribution in About and NOTICE. |

### 7.3 Monitoring

The following are monitored:

- answer and abstention rates;
- grounded ratio;
- unsupported-claim rate;
- safety-trigger rate by rule and language;
- latency, and the share of answers served in fallback mode;
- user feedback.

Prometheus metrics and dashboards cover these. Alerts fire when:

- the grounded ratio drops below 0.9 (7-day mean);
- the fallback share exceeds 20 %;
- safety-trigger rates change by more than 50 % week on week, which may indicate drift or abuse.

---

## 8. Clinical safety and risk management

Clinical risk management follows **ISO 14971 principles** and, for UK NHS deployment, **DCB0129**, with the
deploying organisation applying **DCB0160**. The **Clinical Safety Officer (CSO)**:

- owns the hazard log and signs every release;
- approves every change to `safety.yaml`, `community.yaml`, topic guidance, check thresholds and models.

### 8.1 Hazard log (initial)

| ID | Hazard | Possible harm | Controls in the product | Residual risk |
|---|---|---|---|---|
| H1 | A person in crisis (suicidal thoughts) is not recognised | Death or serious harm | Multilingual crisis patterns (tested phrasings in all five languages, including colloquial ones such as *en finir* and *acabar con todo*); generation blocked; local crisis lines by country; the same rules screen community posts and hold them with immediate help for the author; review prioritised in the moderation queue | Medium. The pattern set needs monthly review against real (anonymised) misses. |
| H2 | Urgent symptoms during treatment (fever on chemotherapy, spinal cord compression signs) are treated as routine | Delayed emergency care | `oncologic_urgent` rule: "contact your care team now" shown first; community posts held with the same guidance | Low–medium |
| H3 | Fabricated or overstated claim | Wrong decisions | Retrieval-only answers; claim verification; unsupported claims flagged or removed; invented numbers rejected; grades capped by design; release gates on the fine-tuned model | Low |
| H4 | Outdated or retracted evidence | Wrong decisions | Retraction flag excludes documents; recency weighting; sync and re-grade on change; library shows year and design | Low |
| H5 | Promotion of harmful "alternative cures" or stopping treatment | Serious harm | `harmful_alternative`, `treatment_decision` and `supplement_interaction` rules; output rules block cure and stop-treatment claims; community posts with such claims are held; treatment questions show a care-team note | Low |
| H6 | False reassurance delays seeing a doctor | Late diagnosis | No symptom interpretation or diagnosis (`diagnosis_request` rule); screening and "worth discussing" prompts; disclaimers on every page | Medium |
| H7 | Lifestyle check misread as a risk prediction | Anxiety or false reassurance | Shown on the device as "not a risk score" on every result; no numbers or probabilities; links to evidence | Low |
| H8 | Blame or stigma ("you caused your cancer") | Psychological harm | Tone rules in prompts; editorial guidance; community guideline 1 and abuse screening | Low |
| H9 | Community misinformation or harassment | Harm, loss of trust | Screening before display; reports with auto-hide at 3; moderator queue; strikes and suspension; no private messages; links only to trusted health organisations | Medium |
| H10 | Exposure of health data | Privacy harm, discrimination | Local-first data; pseudonymous community; hashed tokens; no IP or email stored; members-only and noindex; GDPR export and erasure; security controls (§10) | Low |
| H11 | Prompt injection through documents or posts | Manipulated output | Evidence sanitisation; injection detection; system prompt treats evidence as data | Low |
| H12 | Wrong or outdated crisis-line numbers | Help not reached | Numbers verified locally before launch and then quarterly (`safety.yaml`: "VERIFY LOCALLY BEFORE LAUNCH"); emergency number always shown as well | Low |
| H13 | Model update degrades behaviour | Any of the above | Fail-closed gates; canary; CSO sign-off; instant rollback by switching the LoRA adapter | Low |
| H14 | Over-reliance instead of professional care | Delayed care | Repeated care-team prompts; "next step" line in every answer; About and disclaimers | Medium |

### 8.2 Safety cases and sign-off

Each release ships with:

- a **safety case report**: hazard-log deltas, test evidence (§13) and evaluation reports;
- the CSO's signature.

Incidents follow §14.4. Crisis-pattern misses are treated as high-priority incidents.

---

## 9. Community specification

### 9.1 Why

Peer support can reduce isolation and provide practical, lived-experience tips. Systematic reviews of
peer-support programmes for people with cancer report benefits, especially for psychosocial wellbeing, with
varied quality of evidence (Hoey et al., 2008).

Unmoderated online groups can also spread misinformation and distress. Stepwell's community is therefore:

- **small**;
- **encouragement-first**;
- **screened and moderated**;
- **tied to the evidence**.

### 9.2 Design

- **Circles** (one per journey): *Healthy habits*, *Through treatment*, *Life after treatment*, *Family &
  caregivers*. Each has a **weekly prompt** in five languages that rotates every ISO week.
- **Post types**: small win · encouragement · asking the community · practical tip · plan milestone. Replies are
  one level deep.
- **Reactions are supportive only**: 💛 sending support · 💪 you've got this · 🙏 thank you for sharing · 🌱
  inspired. There is no dislike, no public counts of followers and no public profiles.
- **"What the research says"**: when a post's words match a topic's anchor terms, it links to the published,
  graded insight in the member's language. For example, a tip about swapping wine links to *Alcohol and cancer*
  (High).
- **Care-team note** on posts about treatment decisions, medicines or supplements: "Members share experiences,
  not medical advice."
- **Members-only reading**: pages and API responses are `noindex` and `no-store` and excluded in `robots.txt`.
- **No private messages**. This is a deliberate safety decision that removes grooming, scams and solicitation
  vectors.

### 9.3 Membership

Joining requires:

- a **nickname** (3–24 characters, checked against contact details, staff or clinician impersonation and abuse);
- confirmation of **age ≥ 18** (`COMMUNITY_MIN_AGE`);
- acceptance of the **guidelines**;
- **explicit consent** to processing information that may reveal health (GDPR Art. 9(2)(a)).

The optional journey badge is chosen by the member.

The device receives an **access key**. Only its SHA-256 is stored on the server. The key is the only way to sign
in on another device ("Copy my key"). No name, email, phone or IP address is ever stored.

Members can:

- **download their data** (Art. 15/20);
- **delete their account** (Art. 17). Their words are erased. An opening post with others' replies remains as an
  empty placeholder so the replies keep their context.

### 9.4 Screening and moderation

**Automated screening** runs before a post is shown. It never silently edits text.

| Finding | Action | What the author sees |
|---|---|---|
| Phone number, email, untrusted link | Rejected | How to fix it (links are allowed only to trusted health organisations) |
| Self-harm / medical emergency | Held, **priority 2** | Crisis or emergency guidance and local helplines immediately |
| Urgent symptoms during treatment | Held, priority 1 | "Contact your care team now" |
| Cure claims, "stop your chemo", harmful alternatives | Held | Explanation that medical claims are checked |
| Selling, recruiting, moving people off-platform | Held | Explanation |
| Insults or hostility | Held | Explanation |
| Treatment-decision or supplement questions | Published with a care-team note | — |

**Rules for members:**

- Three open reports auto-hide a post pending review; a crisis report raises its priority.
- Three removed posts suspend an account. A suspended member can still read.
- Rate limits: 6 posts and 30 replies per hour, 20 reports per day, 300 reactions per hour.

**Moderators** (trained in safeguarding and mental-health first aid) work from the admin queue, ordered by
priority, then reports, then age. They can approve, remove or pause a member.

**Moderation service levels:**

| Item | Target |
|---|---|
| Crisis items | Under 1 hour during staffed hours |
| Everything else | Under 24 hours |
| Staffed hours | Published in the guidelines |
| Out of hours | The guidelines state the community is not watched around the clock; helplines are shown |

**Transparency:** authors see why a post is held. Appeals go to the community lead. A quarterly transparency
report publishes counts of held and removed posts by reason.

### 9.5 Community health metrics (not engagement metrics)

| Metric | What it measures |
|---|---|
| Share of posts receiving a supportive reaction or reply within 24 hours | Whether people are answered |
| Time to moderation | Moderation responsiveness |
| Reports per 100 posts | Community health |
| Share of posts held | Screening load |
| Members' self-reported "I felt supported" | Short in-app survey, opt-in, v1.1 |

---

## 10. Privacy, security and regulation

### 10.1 Data inventory

| Data | Where | Retention | Legal basis (GDPR) |
|---|---|---|---|
| Profile, plan, lifestyle-check answers, conversation, language, theme | **Device only** | Until the user deletes them ("Delete my data from this device") | n/a (not processed by Stepwell) |
| Questions and answers | Processed in memory; **not stored** by default (`STORE_CONVERSATIONS=false`). If enabled for quality, stored PII-scrubbed. | Off by default (30 days if enabled) | Art. 6(1)(f) / Art. 9(2)(a) consent if enabled |
| Feedback (rating, reasons, comment) | Server, PII-scrubbed | 12 months | Art. 6(1)(f) |
| Community: nickname, journey badge, posts, reactions, reports, token hash | Server | Until deleted by the member; removed content purged after 90 days | Art. 9(2)(a) explicit consent |
| Operational logs | Server, no bodies, no IP storage beyond rate-limit memory | 30 days | Art. 6(1)(f) |

- A **DPIA** is mandatory before launch because of health data and the community.
- Records of processing are kept.
- Processors are under data processing agreements (cloud, model hosting). The default deployment self-hosts the
  model, so no third-party LLM sees user questions.
- There is no advertising, no third-party analytics and no cross-site tracking.

### 10.2 Security controls

**Network and HTTP:**

- TLS everywhere, with HSTS.
- Security headers: `nosniff`, `DENY` framing, referrer policy and permissions policy.
- CORS allow-list.
- Rate limits per client, backed by Redis across replicas.

**Access and secrets:**

- The admin API key is compared in constant time; the admin API is disabled in production without a key.
- Secrets are referenced as `${ENV}` in source configuration and never stored in plain text; credentials in
  source configuration are redacted in every API response.

**Input validation:**

- Pydantic validation on every request; errors never echo input.

**Containers and Kubernetes:**

- Non-root containers with no OS packages (the API image ships wheels only).
- Read-only root filesystems in Kubernetes, with all capabilities dropped and seccomp `RuntimeDefault`.
- Network policies default-deny ingress.
- Pod security level *restricted*.

**Process:**

- Dependency updates and image scanning in CI.
- Annual penetration test plus one before launch.
- Backups: Postgres PITR (RPO ≤ 15 min), Qdrant snapshots (daily) and immutable object storage for the library.

### 10.3 Threat model highlights

- Account takeover is limited to the community; tokens are 256-bit random values.
- Scraping is prevented by members-only access, rate limits and noindex.
- Moderation evasion through spelling variants is handled by accent and ligature folding, multilingual
  patterns, reports and human review.
- Poisoning of the evidence library is controlled at source: only operators can link sources, and each source
  has a credibility class and an audit trail.

### 10.4 Regulatory positioning (to be confirmed by regulatory counsel before launch)

**Intended purpose:**

> General, evidence-based health education and peer support for adults about lifestyle and wellbeing in relation
> to cancer. It is not intended to diagnose, treat, monitor, predict or prevent disease in an individual, nor to
> inform clinical management.

Design choices that support non-device status:

- no individual risk calculation;
- no symptom interpretation;
- no treatment recommendations;
- the lifestyle check compares habits with public recommendations;
- answers summarise literature for the general public.

| Jurisdiction | Reference | What it covers |
|---|---|---|
| EU | MDR 2017/745 and MDCG 2019-11 | Qualification of software |
| UK | MHRA guidance on software and AI as a medical device | Qualification of software |
| US | FDA *General Wellness* guidance (2019) and the 21st Century Cures Act software provisions | Qualification of software |
| EU | AI Act | Transparency obligations: users are told they interact with AI-generated content; the model card is published |

Any future feature that personalises clinical decisions requires re-qualification **before** development.

---

## 11. Accessibility, localisation and store readiness

### 11.1 Accessibility

The target is **WCAG 2.2 AA**:

- semantic landmarks, headings and skip link;
- focus states, with targets of 44 px or more and 24 px minimum for chart marks;
- colour never the only signal;
- charts have screen-reader table equivalents;
- reduced motion respected;
- text scales to 200 %;
- VoiceOver and TalkBack labels on mobile.

Audits are automated (axe) in CI (v1.1), with a manual audit by an accessibility specialist before launch.
Usability tests include people with low vision, older adults and people with limited health literacy.

### 11.2 Localisation

- Languages are EN, FR, ES, PT and DE. Interface dictionaries are type-checked for completeness: a missing key
  fails the build.
- Insights are generated per language. Answers are written in the user's language.
- Dates are formatted in the user's locale. Crisis lines are chosen by country.
- Native-speaker clinical review of every language is required before launch.

### 11.3 App store submission checklist

- [ ] App name "Stepwell", subtitle "Cancer prevention & support"; category Health & Fitness (not Medical).
- [ ] Privacy nutrition labels (Apple) and the Data safety form (Google). They declare:
  - community posts linked to a pseudonymous ID;
  - no tracking;
  - no data sold;
  - deletion available in the app.
- [ ] Medical disclaimer in the description and on first launch. Apple guideline 1.4.1 (health apps) — no
  diagnostic claims.
- [ ] User-generated content requirements (Apple 1.2, Google UGC policy):
  - reporting;
  - blocking content: a reported post auto-hides at the threshold;
  - moderation;
  - published guidelines;
  - contact information.
- [ ] Age rating 17+/18+ because of the community, with the age gate in the app.
- [ ] Crisis lines verified for every launch country.
- [ ] Accessibility statement and support URL; privacy policy URL; account deletion in the app (Apple 5.1.1(v)).
- [ ] Screenshots in five languages; no real patient images.
- [ ] Build signing via EAS (`mobile/eas.json`), with the production API URL and certificate pinning considered.

---

## 12. Architecture and non-functional requirements

See `docs/ARCHITECTURE.md` for diagrams and components. In summary:

| Component | Technology |
|---|---|
| Engine | FastAPI (Python 3.11+) — stateless API replicas; Redis queue workers for ingestion, insights, evaluation and exports; leader-elected sync scheduler |
| Storage | PostgreSQL (metadata, insights, community, jobs), Qdrant (dense + sparse vectors) and object storage (library) |
| Web | Next.js 16 PWA (standalone), server-rendered pages with ETag caching and a streaming proxy to the API |
| Mobile | Expo SDK 57 (React Native 0.86): iOS, Android and web |
| Shared | One TypeScript package for the API client, types, i18n, evidence helpers, lifestyle check and plan logic |
| Model | vLLM serving Llama with LoRA (GPU node pool) or Ollama (CPU) |

| Requirement | Target |
|---|---|
| Availability | 99.9 % monthly for web and API (excludes the model server; extractive fallback keeps service) |
| Latency (p95) | Pages < 1.0 s TTFB; insight API < 300 ms; first answer token < 2.5 s (GPU LLM) / < 0.8 s (extractive) |
| Scalability | Stateless API and web scale horizontally (HPA); workers scale with the queue; Qdrant sharding and replication; insight pages cacheable at the CDN |
| Capacity (initial) | 50 000 monthly users, 5 000 questions/day, 1 000 community posts/day, a library of 100 000 documents |
| Recovery | RPO ≤ 15 min (database), ≤ 24 h (vectors, rebuildable from the library); RTO ≤ 4 h |
| Observability | Prometheus metrics (`/metrics`), JSON logs with request IDs, health and readiness probes, job history |
| Sustainability | Extractive mode needs no GPU; small model options; insight caching avoids regeneration |

---

## 13. Quality assurance and evaluation

| Layer | What runs | Where |
|---|---|---|
| Engine | Unit and integration tests: ingestion, retrieval, grading, verification, safety (including multilingual crisis phrasing and false-alarm cases), chat streaming, insights, jobs, community (screening, privacy rights, CORS) | `backend/tests` (CI) |
| Shared | i18n completeness and placeholders, client (SSE, community headers), lifestyle check, plan streaks | `packages/shared/test` (CI) |
| Web / mobile | Type-checking; production build; Metro bundle; Playwright smoke screenshots (manual, v1.1 in CI) | CI |
| Model | Data validation, review gate, behavioural metrics, release gates | `ml/tests` (CI); `stepwell-ml evaluate` |
| Platform evaluation | Golden questions per journey and language (`data/eval/`): recall@k, MRR, groundedness, citation precision, abstention, safety flags | Admin console → *Run evaluation* |
| Human | Clinical review of insights; native-speaker review; usability tests per journey (5 participants per journey per round); accessibility audit; penetration test | Before launch and each major release |

---

## 14. Deployment and operations

### 14.1 Environments

| Environment | Runs on | Notes |
|---|---|---|
| Development | Laptop | SQLite, local index, inline jobs, extractive or Ollama |
| Staging | Kubernetes or Compose | Production-like with a staging library; used for clinical review of new insights |
| Production | Kubernetes | `deploy/k8s/overlays/production` |

### 14.2 Release

1. Pull request.
2. CI is green.
3. Reviewers sign off; the CSO signs when the change is safety-relevant.
4. Images are tagged.
5. Staging deploy, then smoke tests and evaluation.
6. Production rolling deploy, with a model canary when relevant.

### 14.3 Running the library

1. Link buckets in `sources.yaml` or the console.
2. Sync runs automatically every 5 minutes.
3. Insights rebuild after changes.

The **"awaiting data"** state is normal until documents are linked: the platform is fully functional and says so.

### 14.4 Incidents

| Severity | Examples | Response |
|---|---|---|
| Sev 1 | Safety failure, data exposure | Page on-call; disable the affected feature (feature flag or rollback); CSO and DPO informed within 1 h; regulator or user notification as required (GDPR: 72 h) |
| Sev 2 | Wrong content at scale, community abuse wave | Hold or rollback; post-mortem within 5 working days |

### 14.5 Moderation operations

- Rota covering staffed hours.
- Escalation path to the CSO for crisis content.
- Weekly calibration of moderators.
- Quarterly transparency report.

---

## 15. Roadmap

| Version | Scope |
|---|---|
| **1.0** (this build) | Everything in §4–§14 |
| 1.1 | Opt-in local reminders; in-app "I felt supported" survey; automated accessibility tests; Playwright end-to-end tests in CI; offline insight packs on mobile |
| 1.2 | More languages (Italian, Arabic, with right-to-left layout); audio read-aloud; "Questions to bring to your appointment" builder (individual-facing, no clinical advice) |
| 2.0 | Optional end-to-end-encrypted sync of plan and profile across devices; optional step-count import from Apple Health / Health Connect (on device); research partnerships to evaluate outcomes (pre-registered) |

---

## 16. Launch acceptance criteria (definition of done)

- [ ] All CI suites green. Model release gates pass. The platform evaluation meets its targets: safety 100 %,
  groundedness ≥ 0.95, abstention correctness ≥ 0.9.
- [ ] A library linked with at least the frameworks in §17 and enough research that ≥ 80 % of topics publish in
  every language.
- [ ] Clinical review of every published insight (all languages) and of the safety rules. Crisis lines verified.
- [ ] Signed off: DPIA, regulatory qualification memo, penetration test, accessibility audit.
- [ ] Community: moderators trained; rota and escalation tested; guidelines and transparency page live.
- [ ] Trademark and domain cleared. Privacy policy, terms, accessibility statement and "Built with Llama" notice
  published.
- [ ] The CSO signs the safety case report.

---

## 17. References (frameworks and methods)

- International Agency for Research on Cancer (IARC). *European Code Against Cancer* (current edition).
- World Cancer Research Fund / American Institute for Cancer Research. *Diet, Nutrition, Physical Activity and
  Cancer: a Global Perspective.* Continuous Update Project Expert Report, 2018 — Cancer Prevention
  Recommendations.
- World Health Organization. *WHO guidelines on physical activity and sedentary behaviour.* Geneva: WHO, 2020.
- Rock CL, et al. American Cancer Society guideline for diet and physical activity for cancer survivors.
  *CA Cancer J Clin.* 2022.
- Ligibel JA, et al. Exercise, diet, and weight management during cancer treatment: ASCO guideline.
  *J Clin Oncol.* 2022.
- Campbell KL, et al. Exercise guidelines for cancer survivors: consensus statement from international
  multidisciplinary roundtable. *Med Sci Sports Exerc.* 2019.
- Lyman GH, et al. Integrative therapies during and after breast cancer treatment: ASCO endorsement of the SIO
  clinical practice guideline. *J Clin Oncol.* 2018.
- Guyatt GH, et al. GRADE: an emerging consensus on rating quality of evidence and strength of recommendations.
  *BMJ.* 2008.
- Hoey LM, et al. Systematic review of peer-support programs for people with cancer. *Patient Educ Couns.*
  2008;70(3):315–337.
- Lebel S, et al. From normal response to clinical problem: definition and clinical features of fear of cancer
  recurrence. *Support Care Cancer.* 2016.
- ISO 14971:2019 *Medical devices — Application of risk management to medical devices* (principles applied).
- NHS Digital DCB0129 / DCB0160 clinical risk management standards (UK deployments).
- MDCG 2019-11 *Guidance on qualification and classification of software* (EU).
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2.*
