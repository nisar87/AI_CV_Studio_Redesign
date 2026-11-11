# ADR-0004: Hosting — Vercel first, Docker-portable

**Status:** Accepted (Phase 0, November 2026)

## Decision
Deploy to Vercel (Node runtime) with per-PR previews. PDF rendering uses `puppeteer-core` with `@sparticuz/chromium` on Vercel and system Chrome locally/in Docker, selected at runtime. Maintain a Dockerfile (Next.js standalone + Chromium) built in CI so we can move to Fly.io/Render/any VM, or split PDF into its own service behind the same API contract, without code changes.

## Consequences
+ Fast start, zero-ops previews.
− Serverless cold starts for PDF (~1–3 s first request); acceptable for MVP, monitored.
