# App store submission

Everything the stores ask for that can be prepared in advance. Items marked **decide** need the owner or counsel.
Replace the placeholder domain `app.stepwell.example` everywhere before submitting.

## Texts (7 languages)

| Store | Where | How to upload |
|---|---|---|
| App Store | `mobile/store.config.json` (title, subtitle, promotional text, description, keywords, URLs) | `cd mobile && eas metadata:push` |
| Google Play | `mobile/store/google-play/<locale>/` (title, short and full description) | Paste into Play Console, or `fastlane supply --metadata_path mobile/store/google-play` |

`scripts/check_store_listing.py` (run in CI) keeps the texts within the stores' length limits.

- **Support URL:** `/{lang}/imprint`, which carries the contact details.
- **Privacy policy URL:** `/{lang}/privacy`.
- **Category:** Health & Fitness, not Medical (BUILD_SPEC §11.3).

## Apple: App Privacy ("nutrition label")

Apple counts data as *collected* when it leaves the device and is kept longer than needed to answer the request in
real time. Based on what the code does (BUILD_SPEC §10.1, privacy policy):

| Data | Collected? | Linked to the person? | Purpose | Notes |
|---|---|---|---|---|
| Questions and profile details sent with them | **No** | — | — | Processed in memory to write the answer; not stored. |
| Step counts (motion sensor, Apple Health) | **No** | — | — | Read and shown on the device only. |
| Plan, profile, lifestyle check, appointment questions | **No** | — | — | On the device only. |
| Community posts and replies | Yes: **Other User Content** | Yes (pseudonymous member) | App Functionality | Optional; only for people who join. |
| Community nickname / member id | Yes: **User ID** | Yes | App Functionality | No name, email or phone number. |
| "Did you feel supported?" answers | Yes: **Other Data** | Yes, until the member leaves | Analytics (community health) | Optional. |
| Feedback on answers (rating, reasons, comment) | Yes: **Other User Content** | No | App Functionality (quality) | Personal details removed. |
| Encrypted sync of plan and profile | **Decide** | No | App Functionality | The server holds ciphertext it cannot read, with no identity. If you treat it as collected, declare **Health** and **Other User Content**, not linked. |

- **Tracking:** none.
- **Third-party SDKs that collect data:** none.
- **Data used for advertising:** none.

## Google Play: Data safety

| Data type (Play category) | Collected | Shared | Processed ephemerally | Required or optional | Purpose |
|---|---|---|---|---|---|
| Health info (questions with profile details) | Yes | No | **Yes** | Optional | App functionality |
| Other user-generated content (community posts) | Yes | No | No | Optional | App functionality |
| User IDs (pseudonymous member id) | Yes | No | No | Optional | App functionality |
| Other user-generated content (feedback) | Yes | No | No | Optional | App functionality |
| App interactions ("Did you feel supported?") | Yes | No | No | Optional | Analytics |
| Fitness info (steps) | **No** (on the device only) | — | — | — | — |
| Encrypted sync | **Decide** (as for Apple) | No | No | Optional | App functionality |

- **Encrypted in transit:** yes.
- **Users can request deletion:** yes, in the app:
  - "Delete my data from this device";
  - community → "Delete my account and posts";
  - turning sync off deletes the server copy.
- **Independent security review:** no, unless you commission a MASA assessment.

## Health data declarations

- **iOS HealthKit.** The HealthKit capability is in the build: read-only access to the step count. In App Store
  Connect, explain that health data is used only to show the person's own step totals on the device, is never sent
  or stored, and is not used for advertising. The privacy policy (section "Step counts, health apps and reminders")
  covers this.
- **Android Health Connect.**
  - Complete the Play Console health permissions declaration for `READ_STEPS`. Purpose: show the user their own
    daily step totals for the last 7 days; data stays on the device.
  - Health Connect shows the privacy policy link on its permission screen.
  - The app's minimum Android version is 8.0.

## Age rating

The community allows members to talk to each other, so answer the questionnaires with:

- **user-generated content:** yes, moderated, with reporting and blocking;
- **messaging:** no private messages;
- **medical or treatment information:** yes, general and educational.

Expect 17+ / 18+ on iOS and the matching IARC rating on Google Play. The app's community requires members to
confirm they are 18 or older (BUILD_SPEC §9.3).

## Notes for App Review (paste into App Store Connect)

> Stepwell gives general, evidence-based information about lifestyle and cancer. It does not diagnose or treat, and
> says so on first launch and in every answer. No login is needed to review the app.
>
> **Community (user-generated content, guideline 1.2):**
> - Open the Community tab → Join, choose a nickname and confirm the three statements (18+, guidelines, consent).
> - Every post is screened before it is shown, and trained moderators review reports.
> - Members can report posts and block other members.
> - The guidelines are linked from the join form, and moderation figures are published in the transparency report.
>
> **Deleting data (5.1.1(v)):**
> - Community → your account → "Delete my account and posts".
> - Me → "Delete my data from this device".
>
> **Health data:** HealthKit is used read-only, for the step count only, and only after the person turns on
> "Use my step history from Apple Health" on the step card. Data stays on the device.
>
> **Encryption:** optional end-to-end-encrypted sync uses standard algorithms (XChaCha20-Poly1305, HKDF-SHA256);
> see the export compliance answer.

## Export compliance (decide with counsel)

`mobile/app.json` declares `ios.config.usesNonExemptEncryption: false`, as in v1.0. Encrypted sync uses standard
algorithms implemented in the app (the audited @noble/ciphers and @noble/hashes libraries) beyond the operating system's own encryption. Before submitting a
build that includes sync:

1. Confirm the classification. It is likely mass-market under EAR §740.17(b)(1), with an annual self-classification
   report.
2. Update the declaration and the App Store Connect answers to match.

## Screenshots (manual)

Take screenshots on a real device or simulator in each of the 7 languages (Arabic right to left), with no real
patient data:

1. home;
2. a cited answer;
3. an insight with its evidence grade;
4. My plan;
5. the lifestyle check results;
6. the community.

Sizes needed:

- iPhone: 6.9" and 6.5";
- iPad: 13", because `supportsTablet` is on;
- Android: phone and 7" tablet.

## Accounts and builds (manual)

- **Apple Developer Program:** organisation membership, which needs a D-U-N-S number. Create the app with bundle id
  `org.stepwell.app`.
- **Google Play Console:** organisation account. Create the app with package `org.stepwell.app`. Complete identity
  verification.
- **EAS:**
  1. `eas init`, then `eas credentials` (signing).
  2. `eas build --profile preview` and test on real phones.
  3. `eas build --profile production`, then `eas submit`.
- **Release:** TestFlight and Play internal testing first. Test on real iPhone and Android phones: the health-store
  switch, weekly notifications, the Arabic layout, offline packs and sync between two devices.
