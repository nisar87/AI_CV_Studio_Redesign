# Authentication, Privacy and Security

## Authentication (Phase 6)

- MVP has **no accounts**: documents live in the user's browser. This removes a whole class of risk and lets people start instantly.
- Phase 6 adds optional sign-in with **email magic link** and **Google**, via Auth.js (database sessions in Postgres). Passwords are intentionally not supported (fewer support issues, no password storage). Final library choice is confirmed in an ADR at the start of Phase 6.
- Sessions: HTTP-only, `Secure`, `SameSite=Lax` cookies; 30-day rolling.
- Authorization: every document query is scoped by `user_id` in the repository layer (never in route handlers alone); tested with cross-user access tests.

## Privacy by design

| Data | Where | Retention |
|---|---|---|
| CV content (MVP) | User's browser only | Until the user deletes it |
| CV content sent for PDF | Server memory during rendering | Not stored |
| CV snippets sent for AI | Server memory + AI provider per its API terms (no training) | Not stored by us |
| Logs | Request id, route, status, latency, token counts | 30 days; no CV content, no emails |
| Accounts (Phase 6) | Postgres (EU or US region chosen at deploy) | Until deletion; 30-day purge |

- No third-party analytics scripts that read page content; privacy-friendly, cookie-less analytics only (e.g., Plausible) for page views and funnel events without CV data.
- Plain-language privacy page; data export (JSON) and deletion available at all times.

## Secrets

- API keys only in server environment variables; validated at boot; never sent to the client; never logged.
- `.env*` git-ignored; `.env.example` documents names only.
- Keys rotated on suspicion; the old project's README mentioned a rotated Gemini key — nothing from it is reused.

## Threat model (top risks and mitigations)

| Threat | Mitigation |
|---|---|
| XSS via CV content in preview | Templates escape all text (React rendering); preview iframe sandboxed without `allow-same-origin`; strict CSP in the document (`default-src 'none'; style-src 'unsafe-inline'; font-src <origin> data:; script-src 'unsafe-inline'` for the paginator only) |
| SSRF / local file access via PDF renderer | Chromium loads content with `setContent`; request interception blocks every network request except `data:` URIs; JavaScript limited to the paginator; no user-provided URLs are fetched |
| Resource exhaustion on PDF/AI | Body size limits, per-IP rate limits, render timeout, per-instance concurrency cap |
| Prompt injection | Outputs are data only; no tools with side effects; validated schemas; user reviews before applying |
| AI cost abuse | Per-device/IP quotas, global daily budget kill switch |
| Malicious backup file import | Zod validation, size cap, ids regenerated on conflict |
| Account takeover (Phase 6) | Magic links single-use, 10-minute expiry; OAuth state/PKCE via library |
| Dependency vulnerabilities | Dependabot/Renovate, `npm audit` in CI (fail on high), lockfile committed |

## Security headers (app)

`Content-Security-Policy` (nonce-based scripts), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), `frame-ancestors 'none'`.
