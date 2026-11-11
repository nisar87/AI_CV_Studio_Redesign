# Deployment

## Environments

| Env | Trigger | Purpose |
|---|---|---|
| Local | `npm run dev` | Development; AI uses `mock` provider unless a key is set; PDF uses local Chrome (`CHROME_EXECUTABLE_PATH` or auto-detect) |
| Preview | Every PR | Per-branch URL for review and e2e against a deployed build |
| Production | Merge to `main` (after CI) | Public site |

## Hosting choice (ADR-0004)

**Primary: Vercel** (Node.js runtime functions). Next.js is first-class there; preview deployments per PR come free.
- PDF function uses `@sparticuz/chromium` (+ `puppeteer-core`), memory 1769 MB, max duration 30 s.
- AI routes: Node runtime, 60 s max duration (20 s per model call, one retry). Set `GEMINI_API_KEY` as a server-only secret on a billing-enabled Google Cloud project.

**Portable alternative: Docker** (`Dockerfile` with Next.js standalone output + Debian Chromium) for Fly.io/Render/any VM. Kept working in CI by building the image, so we are never locked in. If PDF cold starts or bundle limits become a problem on Vercel, the PDF route moves to a small container service behind the same `/api/pdf` contract.

## CI/CD (GitHub Actions)

`ci.yml` on every push/PR:
1. `npm ci`
2. `npm run lint` · `npm run typecheck` · `npm run format:check`
3. `npm test` (Vitest)
4. `npm run build`
5. `npx playwright install --with-deps chromium` · `npm run test:e2e`
6. Upload Playwright report and visual artifacts

Branch protection on `main`: require CI green and one review (the owner); no force pushes.

## Configuration

See `application-architecture.md#configuration`. Production secrets live in the host's encrypted env store. `.env.example` lists every variable.

## Observability

- Structured JSON logs with request id (no CV content).
- Error tracking (Sentry, with PII scrubbing) from Phase 6 / launch hardening.
- `/api/health` for uptime checks.

## Firebase App Hosting (production, chosen November 2026)

The owner's existing Firebase project `ai-cv-studio` serves `aicvstudio.app`. The new app runs on **Firebase App Hosting** (Next.js on Cloud Run) because PDF creation and AI help need a server; classic Firebase Hosting only serves static files.

- Config: `apphosting.yaml` (2 vCPU, 2 GiB for Chromium, max 4 instances, env vars).
- PDF: `@sparticuz/chromium` (no system Chrome on App Hosting). Kept out of the bundle via `serverExternalPackages`; its binary is traced into the standalone output. Verified: production server with system Chrome hidden returns a 1-page PDF with embedded TrueType fonts.
- Secret: `GEMINI_API_KEY` comes from Cloud Secret Manager secret `gemini-api-key` (`firebase apphosting:secrets:set gemini-api-key`, then grant the backend access). Without it AI help is off; everything else works.
- Rollouts: the backend is connected to GitHub `nisar87/AI_CV_Studio_Redesign`, branch `main`; every push to `main` deploys.
- Domain: `aicvstudio.app` moves from the old Hosting site to the App Hosting backend (Firebase console → App Hosting → backend → Settings → Domains); DNS records shown there must be set at the domain registrar.
