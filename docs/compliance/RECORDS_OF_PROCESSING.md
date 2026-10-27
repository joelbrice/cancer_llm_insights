# Records of processing activities (Art. 30(1) GDPR): DRAFT

> **Status: draft prepared from the software (October 2026).** The operator completes the bracketed fields and
> keeps this record up to date. Technical and organisational measures: `docs/compliance/DPIA.md` §5 and
> `docs/SECURITY_REVIEW.md`.

**Controller:** [operator name, address] (`LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_ADDRESS`)
**Representative / managing director:** [name]
**Data protection officer:** [name, contact] (`LEGAL_DPO_CONTACT`)

The following apply to every activity unless stated otherwise:

- **Recipients:** the hosting processors (`LEGAL_HOSTING`), under Art. 28 agreements.
- **Third countries:** none; processing in the EU/EEA [confirm in the hosting contracts].
- **Security measures:** see the DPIA.

## 1. Answering questions (assistant)

| | |
|---|---|
| Purpose | Find evidence in the library and write a cited answer to a question |
| Legal basis | Art. 6(1)(b); Art. 9(2)(a) for health details the person includes |
| Data subjects | Users of the web and mobile apps |
| Data | Question text; earlier messages of the conversation; profile fields the user chose to share (journey, age range, sex, cancer types, treatment phase, country) |
| Storage | None: processed in memory for the duration of the request (`STORE_CONVERSATIONS=false`) |
| Retention | — (if conversation storage is ever enabled: 30 days, personal details removed, only after consent and an update to the privacy policy) |

## 2. Feedback on answers and insights

| | |
|---|---|
| Purpose | Find and correct inaccurate content |
| Legal basis | Art. 6(1)(f): accurate and safe health information |
| Data subjects | Users who choose to rate content |
| Data | Rating, selected reasons, optional comment, with personal details removed automatically; no user identifier |
| Retention | 12 months (automatic purge) |

## 3. Community membership and content

| | |
|---|---|
| Purpose | A moderated, pseudonymous peer-support community |
| Legal basis | Art. 9(2)(a), explicit consent at joining; Art. 6(1)(f) for moderation and safety |
| Data subjects | Community members (18+) |
| Data | Nickname; language; optional journey badge; hash of the access key; posts, replies, reactions, reports, blocks, appeals; strikes and status |
| Recipients | Other members (posts); the operator's moderators (need-to-know) |
| Retention | Until the member leaves (words erased on leaving); removed posts 90 days (automatic purge) |

## 4. Community health survey ("Did you feel supported?")

| | |
|---|---|
| Purpose | Measure whether the community helps (BUILD_SPEC §9.5) |
| Legal basis | Art. 9(2)(a) |
| Data subjects | Members who choose to answer |
| Data | Answer (yes / somewhat / not really) and date, linked to the member until they leave |
| Retention | 12 months (automatic purge); unlinked when the member leaves |

## 5. Transparency report

| | |
|---|---|
| Purpose | Public quarterly report on moderation |
| Data | Anonymous event ledger: kind of event, reason, language, hours to decision. No member, post or text |
| Assessment | Not personal data. Small numbers are suppressed in the public report (`TRANSPARENCY_MIN_CELL`) |

## 6. Encrypted sync between a person's devices

| | |
|---|---|
| Purpose | Keep plan and profile the same on a person's devices |
| Legal basis | Art. 9(2)(a), opt-in |
| Data subjects | Users who turn sync on |
| Data | Ciphertext of plan and profile (unreadable by the operator), version number, SHA-256 of a write secret. No account or device identifier |
| Retention | Until sync is turned off; at most 400 days after the last change (automatic purge) |

## 7. Security, abuse prevention and operations

| | |
|---|---|
| Purpose | Deliver the service securely; limit abuse (rate limits); operate and troubleshoot |
| Legal basis | Art. 6(1)(f) |
| Data subjects | All visitors |
| Data | IP address (held in memory for rate limiting, minutes); request log (time, route, status, duration), without IP address or content |
| Retention | Rate-limit memory: minutes. Logs: 30 days [configure in the logging platform] |

## 8. Contact and data subject requests

| | |
|---|---|
| Purpose | Answer rights requests, accessibility feedback and other messages |
| Legal basis | Art. 6(1)(c) (rights requests); Art. 6(1)(f) (other messages) |
| Data subjects | People who write to the contact address |
| Data | Email address, message content, correspondence |
| Retention | [operator to define, e.g. 3 years after the request is closed] |

## 9. Staff access (moderators, clinical reviewers, administrators)

| | |
|---|---|
| Purpose | Moderate the community, review insights, run the service |
| Legal basis | Art. 6(1)(b) / (f), employment or service contracts |
| Data subjects | Operator staff and contractors |
| Data | Name and role recorded with insight sign-offs; [admin access logs, if single sign-on is used] |
| Retention | Insight sign-offs: for the life of the insight (audit trail); [others to define] |

Data kept only on the user's device (profile, plan, lifestyle check, appointment questions, reminders,
conversation, step counts, offline packs) is not processed by the controller. It is described in the privacy
policy for transparency.
