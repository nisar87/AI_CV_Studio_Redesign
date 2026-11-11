# Project Status (checkpoint)

_Last updated: 2026-11-11_

## Current state

| Phase | Branch | State |
|---|---|---|
| 0 Product design & architecture | `phase-0/product-design` | ✅ Complete, merged to `main` |
| 1 Application foundation | `phase-1/application-foundation` | ✅ Complete, merged to `main` |
| 2 Document model & template engine | `phase-2/template-engine` | ✅ Complete, merged to `main` |
| 3 CV builder MVP | `phase-3/cv-builder` | ⏳ Next |

## Phase 0 report

**Completed:** full documentation set (`docs/README.md` index), five ADRs, phased roadmap with acceptance criteria for Phases 1–4.

**Key decisions:**
- Next.js 16 + React 19 + TypeScript + Tailwind v4; modular monolith (ADR-0001).
- One render path: HTML/CSS templates paginated in-document and printed by Chromium (ADR-0002).
- AI as narrow, schema-validated tasks with a truth guard; Anthropic first, provider-agnostic (ADR-0003).
- Vercel first, Docker-portable (ADR-0004).
- Local-first MVP, accounts in Phase 6 (ADR-0005).
- Launch templates: Clarity, Meridian, Heritage.

**Verification:** consistency review of phase numbers, template ids, AI task ids, preset ids and fixture names across documents.

## Phase 1 report

**Completed:** Next.js 16.4 / React 19 / TypeScript strict app; Tailwind v4 with "Paper & Ink" tokens matching `ux/design-system.md`; self-hosted Figtree + Fraunces; UI components (Button/ButtonLink, IconButton, TextField/TextArea, Card/SelectableCard, Chip/Badge, Banner, Tabs, Segmented, Stepper, Skeleton, Toast); site header (mobile menu, skip link), footer; pages Home, Start (profession picker), My CVs (empty state), Designs (shell), Help, Privacy, 404; `/design-system` showcase (dev or `SHOW_DESIGN_SYSTEM=1`); ESLint, Prettier, Vitest, Playwright + axe; GitHub Actions CI; screenshot script.

**Verification (all green):** `npm run verify` (lint, typecheck, format, unit, build); `npm run test:e2e` — 16 passed (desktop 1440 + Pixel 7): every page renders, no horizontal scroll at device width and 360 px, no serious/critical axe violations (WCAG 2.2 AA tags), skip link + visible focus, mobile menu Escape. Visual review of phone/tablet/desktop screenshots (`artifacts/visual/phase-1/`).

**Issues found and fixed:** duplicate header CTA + horizontal overflow at 390 px (responsive class conflict) — fixed, regression test added at 360 px.

**Known:** 8 moderate `npm audit` advisories in dev-only lint tooling (typescript-eslint transitive); no runtime impact; revisit on next eslint-config-next update. `/cv/new` is an honest placeholder until Phase 3.

## Phase 2 report

**Completed:** Zod resume schema (10 section kinds, design spec, migrations hook); 10 profession presets with sections, hints, suggested skills and default designs; 8 realistic fixtures (driver, teacher, nurse, graduate, engineer, executive, sparse, extreme); render model; design resolution with contrast guard and curated palette; 5 self-hosted OFL font pairs; **Clarity, Meridian, Heritage** templates; in-document paginator (keep-with-next headings, entry heads with first bullets, widow control, running headers, page numbers); double-buffered live preview iframe; `/api/pdf` (Chromium, request interception blocks all network, tagged PDF, rate limit, concurrency cap, error envelope); `/api/health`; Designs gallery rendering real templates with switchable sample CVs; `npm run qa:templates` harness.

**Verification (all green):** 44 unit tests (schema, presets, dates, render model, contrast, determinism, HTML escaping, content preserved across every template/density/font/colour, planner incl. oversize chains, keep rules); 49 e2e tests including **27 parity checks** (3 templates × 8 fixtures on A4 + 3 on Letter): preview page count = PDF page count, zero overflow, all fonts embedded (`pdffonts`), text extractable with name and first role present (`pdftotext`), correct page size (`pdfinfo`). Human visual review of all 24 A4 combinations at 60–90 dpi.

**Issues found and fixed during review:** serialized-function runtime broken by tooling helpers (rewritten as plain JS); contact separators starting wrapped lines (clipped-separator technique); single list item stranded on a new page (list keep rules); Meridian running header overlapping the side column; mid-word breaks in narrow flex rows (`overflow-wrap: break-word`); PDF rate limit tripping the test suite (configurable `RATE_LIMIT_PDF_PER_MINUTE`).

**Known limitations:** Latin/Latin-extended scripts only (other scripts fall back to system fonts, Phase 10); preview in Safari/Firefox may differ from the PDF by a line in rare cases (PDF is authoritative; Download page shows server page count); rate limiter is per instance (shared store needed when scaled out).

## Known blockers

- **GitHub push access:** this session was not granted push access to `nisar87/AI_CV_Studio_Redesign`, so branches were built and merged locally and delivered as a git bundle plus working tree in `D:\Projects\ai_cv_studio_redesign`. See the root `README.md` → "Publishing this repository" for the commands to push all branches.
