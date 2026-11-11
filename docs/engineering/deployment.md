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
