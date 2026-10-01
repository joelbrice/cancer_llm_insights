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
| Settings | Language (EN/FR/ES/PT/DE), theme, API URL, plan, profile, evidence library, methodology, delete local data |

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
