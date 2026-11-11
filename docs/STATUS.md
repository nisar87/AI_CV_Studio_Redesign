# Project Status (checkpoint)

_Last updated: 2026-11-11 (template design sprint)_

## Current state

| Phase | Branch | State |
|---|---|---|
| 0 Product design & architecture | `phase-0/product-design` | ✅ Complete, merged to `main` |
| 1 Application foundation | `phase-1/application-foundation` | ✅ Complete, merged to `main` |
| 2 Document model & template engine | `phase-2/template-engine` | ✅ Complete, merged to `main` |
| 3 CV builder MVP | `phase-3/cv-builder` | ✅ Complete, merged to `main` |
| 3b Signature templates (design sprint) | `phase-3b/signature-templates` | ✅ Complete, merged to `main` |
| 4 AI assistance | `phase-4/ai-assist` | ⏳ Next — not started |

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

## Phase 3 report

**Completed:** browser document repository (validation on read, quarantine of corrupt data, backup/restore that never overwrites); pure document operations; undo/redo with typing coalescing and keyboard shortcuts; debounced autosave with flush on hide/unload; `/cv/new` (creates from profession preset, optional `?design=`); guided creation (steps generated from the CV's sections, only name required, live preview on desktop, "Peek" on phones); studio editor (Content: About you, Profile, section cards with collapse/expand, add/remove/reorder entries and sections by buttons, rename/hide via menu, add section with preset suggestions; Design: style cards, curated colours + any colour with contrast note, 5 fonts, spacing, paper size, name position, skills style); click any part of the preview to jump to its field; "fit on one page" tip; mobile bottom tabs (Edit · Design · Preview); Download page (plain-language checklist, PDF download, Print fallback, per-CV backup); My CVs (thumbnails, edit/download/copy/delete with undo, backup all, restore); Home "Continue where you left off".

**Verification (all green):** `npm run verify`; 55 unit tests (+ ops, repository, history); 56 e2e tests on desktop and Pixel 7, three consecutive clean runs, including the scripted J1 driver journey (guided → editor → reload persistence → undo → design switch keeps content → PDF download named `Imran-Qureshi-CV.pdf`), PDF-failure fallback, keyboard-only reorder/hide with Ctrl+Z, unknown-CV message, axe (WCAG 2.2 AA tags) on guided, editor and download screens; `qa:templates` 24/24. Visual review of guided, editor (content/design), preview, download, My CVs and Home at 1440 and 390 px (`artifacts/visual/phase-3/`, regenerate with `npx tsx scripts/studio-screens.tsx`).

**Issues found and fixed:** stale preview frame could win after the preview became visible (sequence-numbered frames); date selects truncated in narrow columns (short month labels); Escape now closes the phone preview.

**Known / deferred:** the J1 "under 10 minutes" criterion is verified for a scripted run only — moderated tests with real users (driver, teacher, graduate) are recommended before launch; drag-and-drop reordering is not implemented (buttons cover it accessibly); `localStorage` quota errors surface as "Not saved" but no export prompt yet.

## Phase 3b report — signature templates

**Goal:** at least 10 designs with a genuine WOW factor, some with photos, each audited until it reaches 9.5/10.

**Completed:** 7 new designs (Atelier, Ledger, Chronicle, Vivid, Folio, Halo, Sprout) and upgrades to Clarity (accent bar, icons, photo), Meridian (gradient band with angled edge, photo) and Heritage (monogram letterhead). Optional profile photo (browser-side crop/resize, show/hide, initials fallback in four designs). Visual design picker with real thumbnails; gallery of all ten with sample photos; profession presets spread across the new designs; static TrueType fonts; Nunito Sans replaces Lato.

**Audit method:** every design rendered to PDF with 8 realistic CVs (driver, teacher, nurse, graduate, engineer, executive, a name-only CV and an extreme stress case), with and without photos, A4 and Letter; reviewed at full size against a rubric (hierarchy, typography, signature, balance, robustness, ATS safety, colour); four review rounds.

**Final scores (honest, against the best commercial CV templates):**

| Design | Score | Note |
|---|---|---|
| Atelier | 9.6 | Strongest "wow"; sidebar holds up from one to three pages |
| Vivid | 9.5 | Most modern; overlapping portrait is the signature |
| Folio | 9.5 | Most editorial; best with a photo |
| Ledger | 9.5 | Most striking without colour; excellent for tech and senior roles |
| Chronicle | 9.5 | Timeline reads instantly; best for long histories |
| Halo | 9.5 | Most personal; monogram fallback is as good as a photo |
| Meridian | 9.5 | Angled band lifted it from "standard" to distinctive |
| Sprout | 9.5 | Friendliest; side panel fixed long line lengths |
| Heritage | 9.5 | Monogram letterhead gives the classic design a signature |
| Clarity | 9.5 | Deliberately the quietest — scored as best-in-class minimal |

**Issues found and fixed during the audit (12):** stacked contact icons invisible (CSS override); class names glued by the Tailwind Prettier plugin (twice — now `classes()` + test); first-item spacing in every list section; Ledger labels overlapping the next section and breaking mid-word; tight Ledger name tracking; Vivid heading stranded alone on page 1 (planner fix + tests); email/URL breaking mid-word (soft break points); Sprout's checkbox-like marker and over-long lines; Meridian looking generic; Heritage lacking a signature; Type 3 fonts in every PDF (static fonts); Lato missing "ğ" (Nunito Sans).

**Verification (all green):** `npm run verify` (59 unit tests); 121 e2e tests including **103 PDF parity checks** (10 designs × 8 CVs on A4, × Letter, and with photos): preview pages = PDF pages, zero overflow, all fonts embedded as TrueType (no Type 3), text extractable, page sizes correct; photo add/hide/remove and 10-design picker flows; axe clean. `qa:templates` 170/170 combinations including photos and Letter.

**Known limits:** sample portraits are illustrations; real photos should be checked in a moderated test. Designs are tuned for the five font pairs; very unusual colour choices are contrast-corrected but not every combination was reviewed by eye. Scores are the author's judgement — a blind comparison with real job seekers is recommended (see roadmap Phase 11).

## Next action (exact)

Start **Phase 4 — AI assistance** per `delivery/roadmap.md`:
1. `git switch -c phase-4/ai-assist main`
2. Create `src/modules/ai/` with `provider.ts` (`AiProvider` interface), `providers/mock.ts`, `providers/anthropic.ts` (model names from `AI_MODEL_FAST` / `AI_MODEL_SMART`), `tasks/*` (prompt version + Zod output schema), `guard.ts` (truth guard: numbers, years, organisations, credentials not present in input → `{{?…}}` or reject), `limits.ts` (per-device/IP buckets + daily budget switch).
3. Route `src/app/api/ai/[task]/route.ts` using `src/lib/http.ts` envelope.
4. UI: "Help me write" menu on summary and bullets (suggestion card: Use this · Try again · Dismiss), "Describe a style" on Design tab, describe box on Start; render `{{?…}}` markers in preview and feed the Download checklist (already checks them).
5. Tests: truth-guard unit tests first; e2e with mock provider incl. timeout/invalid-output/rate-limit fallbacks.

## Known blockers

- **GitHub push access:** this session was not granted push access to `nisar87/AI_CV_Studio_Redesign`, so phase branches were built, verified and merged locally and delivered as `ai-cv-studio.bundle` (all branches and tags) in `D:\Projects\ai_cv_studio_redesign`. Nothing has been pushed; no PRs or GitHub CI runs exist yet. See the root `README.md` → "Publishing this repository".
- **CI not yet run on GitHub:** `.github/workflows/ci.yml` is written and every step was run locally, but it has never executed on GitHub Actions.
