# Roadmap and Phase Plan

Phases are small enough to verify completely. Each has scope, dependencies, deliverables, acceptance criteria and verification. A phase is complete only when every acceptance criterion is verified and recorded in `STATUS.md`.

MVP = Phases 1–4. First public release = Phases 5–6 + Phase 11 hardening. Growth = Phases 7–10.

---

## Phase 0 — Discovery, product design, architecture
**Branch:** `phase-0/product-design` · **Depends on:** —
**Deliverables:** this `/docs` set, ADRs 0001–0005, `STATUS.md`.
**Acceptance:** all documents listed in `docs/README.md` exist and are mutually consistent (phase numbers, template names, schema names); MVP line defined; every Phase 1–4 item has acceptance criteria.
**Verification:** self-review pass for consistency (cross-reference check of template ids, task ids, phase numbers).

## Phase 1 — Application foundation and visual shell
**Branch:** `phase-1/application-foundation` · **Depends on:** 0
**Scope:** Next.js + TypeScript strict project; tooling (ESLint, Prettier, Vitest, Playwright, axe); CI workflow; design tokens and fonts; core UI components (Button, IconButton, TextField, Textarea, Card, Badge/Chip, Tabs, Toast, Banner, Skeleton, Stepper); global layout (header, footer, mobile menu); studio-bar layout; pages: Home, Start (profession cards, non-functional routing to a placeholder), Templates (placeholder grid), Help, Privacy, 404; component showcase page `/design-system` (dev only).
**Acceptance:**
1. `npm run verify` (lint, typecheck, unit, build) passes; CI workflow file present.
2. Tokens in code match `ux/design-system.md`.
3. Home, Start, Help render correctly at 390, 834, 1440 px with no horizontal scroll; screenshots reviewed.
4. axe: no serious/critical violations on all pages.
5. Keyboard: all interactive elements reachable with visible focus.
**Verification:** Playwright e2e smoke + axe; screenshots in `artifacts/visual/phase-1/`.

## Phase 2 — Document model and template engine
**Branch:** `phase-2/template-engine` · **Depends on:** 1
**Scope:** Zod resume schema + migrations; presets; fixtures (8); render model normalization; design spec + resolution (contrast guard); font pairs; three templates (Clarity, Meridian, Heritage); document builder; in-document paginator with pure `planPages`; preview component (scaled pages in iframe, page-count message); `/api/pdf` with Chromium; `/api/health`; template gallery rendering real fixtures.
**Acceptance:**
1. Switching template/colour/font/density never changes content (unit test).
2. All 3 templates × 8 fixtures render with no overflow flags; no orphaned headings (automated).
3. PDF page count equals preview page count for all 24 combinations (automated).
4. PDF text extracts in reading order and fonts are embedded (automated with poppler).
5. A4 and Letter both correct.
6. Human visual review of every template with driver, teacher, engineer, sparse and extreme fixtures; issues fixed or logged.
**Verification:** Vitest + Playwright PDF suite; screenshots of all combinations.

## Phase 3 — CV builder MVP (no AI)
**Branch:** `phase-3/cv-builder` · **Depends on:** 2
**Scope:** Browser document repository; My CVs (list, duplicate, rename, delete + undo, backup/restore); Start creates a preset document; guided creation wizard (preset-driven steps); studio editor (Content tab: sections/entries CRUD, reorder, hide; Design tab: style cards, template, colour, fonts, density, page size); live preview with click-to-edit; undo/redo; autosave; Download page with checklist, PDF, Print fallback, JSON backup; responsive editor (desktop split, mobile tabs).
**Acceptance:**
1. A new user completes J1 (driver persona) in under 10 minutes in a scripted e2e run and downloads a valid PDF.
2. Refreshing the page at any point loses no saved changes.
3. Undo/redo works for every content and design change.
4. All actions possible by keyboard; reorder without drag.
5. Editor usable at 390 px width (e2e on mobile viewport).
6. PDF service failure shows Print fallback (e2e with route mocked to fail).
**Verification:** e2e flows for J1/J5, axe, visual review desktop + phone.

## Phase 4 — AI assistance
**Branch:** `phase-4/ai-assist` · **Depends on:** 3
**Scope:** `AiProvider` interface; Anthropic + mock adapters; task framework (prompt versioning, schema, repair, truth guard); tasks `intake.interpret`, `design.interpret`, `write.summary`, `write.improveBullets`, `write.fromNotes`, `suggest.skills`; rate limiting and budget switch; UI: describe box on Start, "Describe a style" in Design tab, "Help me write" menus, suggestion cards, needs-input markers and checklist; AI off switch.
**Acceptance:**
1. With the mock provider, all AI UI flows pass e2e, including failure paths (timeout, invalid output, rate limit) with non-AI fallback.
2. Truth guard unit tests: invented numbers, dates, organizations and certifications are converted or rejected.
3. Live evaluation script on fixtures shows 0 invented facts across ≥ 30 samples (manual review of output log).
4. Design interpretation of the two example prompts in the brief ("school teacher… blue… elegant"; "simple CV for a delivery driver") yields sensible, valid specs.
5. No API key reaches the client bundle (build check).

---

## Phase 5 — Import and job tailoring
Paste text import (`import.structure`), PDF/DOCX text extraction with paste fallback, JSON Resume import; master/version model; job ad analysis with evidence; tailored version creation with change review; plain-text export; CV review checklist.
**Acceptance highlights:** imported content always reviewed before it is saved; master never modified by tailoring; every gap claim cites job-ad text.

## Phase 6 — Accounts and cloud sync
ADR for auth library; Postgres + Drizzle; sign-in (magic link, Google); move local CVs to account; sync with conflict handling; account deletion; security headers; Sentry.
**Acceptance highlights:** cross-user access tests; delete account removes all data; offline edits reconcile.

## Phase 7 — Cover letters and application documents
Letter document type sharing design tokens with the CV; `letter.draft`, application email, follow-up, thank-you; "Application kit" per job.

## Phase 8 — Advanced studio
Additional templates (to 6–8, each passing the checklist), custom sections UI, optional photo, section layout options, DOCX export, more font pairs.

## Phase 9 — Portfolio studio
Public portfolio pages from CV + projects; themes; slugs; publish/unpublish; SEO and privacy controls.

## Phase 10 — Career intelligence and languages
Interview practice, LinkedIn suggestions, skill-gap insights, CV translation, non-Latin fonts and RTL.

## Phase 11 — Launch hardening (also run as a gate before the first public release after Phase 6)
Performance budgets, full a11y audit, security review and headers, load test for PDF/AI, analytics, legal pages, backups, runbooks.
