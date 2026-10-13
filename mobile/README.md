# Stepwell mobile (iOS · Android · web)

Expo SDK 57 / React Native 0.86 app sharing its API client, types, translations, evidence helpers, lifestyle
check and plan logic with the web platform (`packages/shared`). Everything a person enters (profile, plan,
lifestyle-check answers, language, theme) stays on the device in AsyncStorage.

| Tab / screen | What it does |
| --- | --- |
| Home | Library status, quick question, audience paths, featured insights |
| Ask | Streaming answers (`expo/fetch` SSE) with tappable `[n]` citations → source sheet with the quoted passage, evidence grade, statement verification, safety banner first for urgent situations, feedback |
| Insights | Filter by topic / audience, search |
| Insight | Key points, recommendations (→ *My plan*), limitations, evidence profile (grade rationale, study-design bars), references with quotes, share |
| Check | 15-question lifestyle check vs. ECAC / WCRF / WHO recommendations, computed on device — explicitly *not* a risk score |
| Plan | Weekly check-ins and streaks; optional weekly reminder (local notification); optional step count from the phone's motion sensor |
| Appointment | Questions for your next appointment: pick from a bank by journey, add your own, reorder, take notes, share or print |
| Community | Circles, posts and replies, reactions, reports, blocking, appeals of moderation decisions, "I felt supported" (optional), transparency report |
| Settings | Language (EN/FR/ES/PT/DE/IT/AR), theme, API URL, plan, profile, offline insight packs, encrypted sync, evidence library, methodology, delete local data |

Insights can be read aloud (`expo-speech`, the device's own voices).

## Optional features and permissions

Every feature below is off until the person turns it on; nothing changes for anyone who does not.

| Feature | Permission | Notes |
| --- | --- | --- |
| Weekly reminder | Notifications (`expo-notifications`), asked when the reminder is turned on | Scheduled on the device; no push server, no token sent anywhere |
| Step count | Motion & Fitness on iOS, physical activity on Android (`expo-sensors`) | iOS shows the last 7 days; Android has no step history without Health Connect, so the count is live while the app is open. Steps never leave the phone |
| Offline packs | — | Every published insight in one language, stored on the device (AsyncStorage) |
| Encrypted sync | — | Plan and profile, end-to-end encrypted with a code only the person holds (`packages/shared/src/sync.ts`). Uses `expo-crypto` for random bytes. See the export-compliance item in `docs/BUILD_SPEC.md` §11.3 before store submission |

## Right-to-left (Arabic)

Choosing Arabic lays the app out right to left from the root view (and in modals, which are separate roots), with
logical start/end styles and mirrored directional icons. The native navigation header and back gesture follow the
device language; nothing changes for the other six languages.

## Run

```bash
pnpm install                      # from the repository root (hoisted node_modules, see .npmrc)
cp mobile/.env.example mobile/.env
# point EXPO_PUBLIC_API_URL at the API — use your computer's LAN IP for a physical phone
pnpm --filter @stepwell/mobile start      # then press i / a / w, or scan the QR code with Expo Go
```

The API must allow the app's origin for the web target (`CORS_ORIGINS`, defaults include
`http://localhost:8081`). Native apps are not subject to CORS.

## Checks and builds

```bash
pnpm --filter @stepwell/mobile typecheck
pnpm --filter @stepwell/mobile exec expo export --platform android   # Metro bundle smoke test (CI)
pnpm --filter @stepwell/mobile exec eas build --profile preview       # signed builds via EAS (needs an Expo account)
```

Store submission checklist (privacy labels, medical disclaimer, crisis-line verification per country) lives in
`docs/BUILD_SPEC.md` §11.
