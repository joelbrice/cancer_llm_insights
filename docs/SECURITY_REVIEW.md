# Security review (pre-launch, October 2026)

An internal review of the whole platform before launch. It does not replace the external penetration test
(BUILD_SPEC §10.2, §16); the scope for that test is at the end.

## Method

- **Manual review** of authentication, input handling, data flows and deployment configuration across the API, web,
  mobile and Kubernetes manifests, against the threat model in BUILD_SPEC §10.3.
- **Static analysis:** bandit on `backend/` and `ml/`.
- **Known vulnerabilities in dependencies:** pip-audit (backend with production extras, ml) and `pnpm audit` (web,
  mobile, shared).
- **Manifests:** kustomize build and schema validation (kubeconform) of the production and staging overlays.
- **Production parity:** the backend test suite and the end-to-end suite were run on PostgreSQL 16 and Redis 7, as
  production runs, instead of SQLite only.

## Findings and fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Medium | **Rate limits could be bypassed by sending a fake `X-Forwarded-For` header.** The API keyed limits on the left-most entry, which the client controls, and uvicorn trusted forwarded headers from any peer even with `TRUST_FORWARDED_FOR=false`. | The address is read `FORWARDED_FOR_HOPS` entries from the right (default 1), and uvicorn trusts forwarded headers only when `TRUST_FORWARDED_FOR` is on. Tests cover rotating headers. |
| 2 | Medium (data loss) | **Documents with metadata failed to import on PostgreSQL.** Their change-detection fingerprint exceeded its 128-character column, which SQLite ignores but PostgreSQL enforces. Production would silently drop part of the library. | Long fingerprints are stored as their SHA-256, and every document field is fitted to its column. Identifiers such as a DOI or URL are dropped rather than cut. CI now runs the backend tests on PostgreSQL, and the end-to-end tests on PostgreSQL and Redis. |
| 3 | Low | **No request size limit outside Kubernetes** (the ingress allows 2 MiB; Compose and direct access had no limit), so large bodies could exhaust memory. | Bodies over `MAX_REQUEST_BYTES` (2 MiB) get 413, including chunked uploads. |
| 4 | Low (privacy) | **uvicorn's access log wrote client IP addresses and full paths**, which contradicts the data inventory (§10.1: no IP storage in logs). | uvicorn's access log is off. The API logs method, route template, status and duration, with no address or query string. |
| 5 | Low | **The public `/api/v1/status` listed source locations** (bucket names, server paths). | Hidden in production and staging; the admin API still shows them. |
| 6 | Low | **No Content-Security-Policy on the web app.** HSTS relied on an ingress `configuration-snippet`, which ingress-nginx rejects by default since v1.9 (so applying the manifests would fail). | CSP and HSTS are set by the web app; the API already sends HSTS in production. The snippet is removed. |
| 7 | Info | No `security.txt`. | `/.well-known/security.txt` is served from the operator's contact address (RFC 9116). |
| 8 | Info | Dependency scanning was described in BUILD_SPEC but not set up. | CI audits Python and JavaScript dependencies and validates both overlays; Dependabot proposes updates weekly. |
| 9 | Info | The base model was downloaded without a pinned revision, so a changed upstream repository could alter a reviewed model. | Optional `base_model_revision`, recorded in the run card. |
| 10 | Info | SHA-1 is used for ETags and document ids. This is not a security use, but it is flagged by scanners and FIPS systems. | Marked `usedforsecurity=False`; values are unchanged. |
| 11 | Info | Llama licence: the "Built with Llama" notice was not shown. | Shown on the About page (web and mobile) when the fine-tuned model answers. |
| 12 | Critical | **Next.js advisories published on 26 October 2026** (found by the new CI audit). Next.js 16.0–16.4.0 has two unauthenticated remote code execution flaws (Image Optimization API: GHSA-2464-fhr4-w9xw; `use cache`: GHSA-673q-mjm6-r5xr) and a Server Actions denial of service (GHSA-p3m5-59mp-jv5r). | The web app is upgraded from 16.3.8 to 16.4.2. |
| 13 | High | **pypdf advisory (CVE-2026-115572)** in the PDF reader that parses documents from linked buckets, which are untrusted input. | The minimum version is raised to 6.21.2 in `backend/pyproject.toml`. certifi (PYSEC-2026-4320) is updated automatically on a fresh install. |

## Reviewed and found sound

**Access control:**

- **Admin API:** the key is compared in constant time. In production and staging, the API refuses admin requests
  when no key is set.
- **Community:** members are identified by 256-bit random tokens. The server stores only their hash and looks them
  up by hash.
- **Encrypted sync:**
  - it stores ciphertext only;
  - the write secret is checked with `compare_digest`;
  - ciphertext format and size are validated;
  - writes are rate-limited per sync id;
  - there are no accounts.

**Input and output:**

- **Validation:** Pydantic length and range limits apply on every request body. Validation errors never echo the
  input, which may contain health details.
- **Injection:**
  - database access goes through the SQLAlchemy ORM only, with no SQL built from strings;
  - YAML is read with `safe_load`;
  - the API has no `eval`, `pickle` or shell calls.
- **XSS:**
  - React escapes all text;
  - the only inline script is a constant (the theme);
  - answers render bold text without `innerHTML`;
  - member and source text keep their direction with `dir="auto"`.
- **CORS:** an allow-list, without credentials.

**Transport, platform and data:**

- **Headers and caching:**
  - the API sets `nosniff`, `DENY` framing, `no-referrer` and a permissions policy;
  - community responses are `no-store` and `noindex`.
- **Containers:** they run as non-root with read-only root filesystems, all capabilities dropped and seccomp
  `RuntimeDefault`. Pod Security is `restricted`. Network policies deny ingress by default, and the backup jobs meet
  the same rules.
- **Secrets:** they appear only as `${ENV}` references, and credentials are redacted in API responses. The two
  GitGuardian alerts on this branch are false positives: Compose interpolation syntax, and a password-less CI
  service container.

## Accepted risks (revisit before each major release)

- **`'unsafe-inline'` in the script policy.** Next.js streams page data in inline scripts, and nonces would make
  every page dynamic. The policy still blocks plugins, framing, foreign form targets and `<base>`, and limits
  connections to the site and its API.
- **Advisories in Expo's command-line tooling.**
  - node-forge (GHSA-86w9-cpqp-85rv) and braces (GHSA-vfj7-8cjw-p6xm) have no patched release yet. They are used
    only at build time and are not in the app bundle or the web server. They are listed under
    `pnpm.auditConfig.ignoreGhsas` in `package.json`; remove them when Expo ships fixed versions.
  - zod 3.x (GHSA-mrhx-c7xc-m3w5: memory exhaustion on oversized input) is likewise used only by `@expo/cli` to
    validate local project configuration. The fix exists only in zod 4, which `@expo/cli` does not support yet.
    Listed with the others.
  - Two moderate advisories (uuid, decode-uri-component) are also in Expo tooling and URL parsing on the device.
- **Compose behind a reverse proxy.** The Next.js server passes the client's `X-Forwarded-For` through unchanged.
  A Compose deployment must therefore:
  - run behind a TLS reverse proxy that overwrites the header (Caddy and nginx do by default);
  - not expose ports 3000 and 8000 publicly.

  Kubernetes is not affected: ingress-nginx replaces the header.
- **One shared admin key.** There is no per-person audit trail of admin actions, apart from the reviewer named on
  insight sign-offs. Recommended for production: put `/…/admin` and `/api/v1/admin` behind single sign-on or an IP
  allow-list at the ingress.
- **No certificate pinning in the mobile app.** TLS with the platform trust store is used; pinning was weighed
  against the risk of locking users out when certificates rotate.

## Scope for the external penetration test

1. **Public API:**
   - chat streaming and search: rate limits, prompt injection through questions and through library documents;
   - insights, documents and transparency;
   - feedback and the 413/422 handling.
2. **Community:**
   - token handling;
   - screening evasion (spelling variants, other scripts);
   - report, block and appeal abuse;
   - enumeration of posts and members;
   - authorisation between members.
3. **Encrypted sync:** guessing or brute-forcing sync ids, version races, write-secret handling, deletion.
4. **Admin API and console:** key handling, source registration (URLs pointing to internal services, i.e. SSRF via
   HTTPS sources), job endpoints.
5. **Web:** CSP effectiveness, open redirects in locale routing, cache poisoning (ETag and `Vary`), service worker
   scope.
6. **Mobile:** local storage of the community token and sync code, deep links, behaviour on rooted or jailbroken
   devices.
7. **Infrastructure (staging):** ingress, network policies, exposed metrics and probes, the backup volume.
