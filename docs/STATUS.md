# Project Status (checkpoint)

_Last updated: 2026-11-14 (live on Firebase App Hosting at aicvstudio.app)_

## Current state

| Phase | Branch | State |
|---|---|---|
| 0 Product design & architecture | `phase-0/product-design` | ✅ Complete, merged to `main` |
| 1 Application foundation | `phase-1/application-foundation` | ✅ Complete, merged to `main` |
| 2 Document model & template engine | `phase-2/template-engine` | ✅ Complete, merged to `main` |
| 3 CV builder MVP | `phase-3/cv-builder` | ✅ Complete, merged to `main` |
| 3b Signature templates (design sprint) | `phase-3b/signature-templates` | ✅ Complete, merged to `main` |
| 3c External template review fixes | `phase-3c/template-review-fixes` | ✅ Complete, merged to `main` |
| 3d Pagination & edge-case polish (2nd review) | `phase-3d/pagination-polish` | ✅ Complete, merged to `main` |
| 3e Final template polish (3rd review) | `phase-3e/final-polish` | ✅ Complete, merged — templates frozen for now |
| 4 AI assistance (Gemini) | `phase-4/ai-assist` | ✅ Complete. Live acceptance met on production 2026-11-12 (48/48, 0 invented facts) |
| R1 Paid CV Studio (R1.1–R1.6) | `r1/*` | ✅ Live on aicvstudio.app; sales open when the owner adds payment details |
| R2 Job-ready | `r2/job-ready` | ✅ Live on aicvstudio.app (2026-11-12) |
| R3 Professional presence | `r3/presence` | ✅ Live on aicvstudio.app (2026-11-12) |
| R4 Growth | `r4/growth` | ✅ Live on aicvstudio.app (2026-11-12); card gateway and Urdu deferred |
| R5 Instant Makeover | `r5/makeover` | ✅ Live on aicvstudio.app (2026-11-13), verified with real Gemini |
| R6 Design engine | `r6/design-engine` | ✅ Live on aicvstudio.app (2026-11-13); Design Studio switched on and checked live |
| R7 Describe your design | `r7/describe` | ✅ Live on aicvstudio.app (2026-11-13): 32 designs, AI Designer on, verified with real Gemini; preference test and outside review are owner to-dos |
| R8 One studio | `r8/studio` | ✅ Live on aicvstudio.app (2026-11-13): studio shell and Home, letters, Presence, application kit, ATS check, 24 section types, edit on the page, Console switches |
| R9 Coach | `r9/coach`, `r9/stories` | 🟡 In progress: mock interview, career coach and story bank live (2026-11-14) |

## Phase 0 report

**Completed:** full documentation set (`docs/README.md` index), five ADRs, phased roadmap with acceptance criteria for Phases 1–4.

**Key decisions:**
- Next.js 16 + React 19 + TypeScript + Tailwind v4; modular monolith (ADR-0001).
- One render path: HTML/CSS templates paginated in-document and printed by Chromium (ADR-0002).
- AI as narrow, schema-validated tasks with a truth guard; Gemini first (ADR-0006), provider-agnostic (ADR-0003).
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

## Phase 3c — response to the external template review (2026-11-11)

An independent review of the 10 sample PDFs scored the set 7.1–8.5 (average 7.8), against our own 9.5. Each point was checked against the actual PDFs before acting.

**Accepted and fixed (verified):**
- **PDF reading order (confirmed, serious):** bullets were extracted after all later sections in 9 of 10 designs because positioned list items are painted in a later pass. Every block is now positioned, so paint/extraction order equals document order. New e2e test per design checks that a job's first bullet extracts before the next job and education.
- **No clickable links (confirmed):** phone, email and web links are now real `tel:` / `mailto:` / `https:` links in the PDF (checked by test). Links never navigate the preview.
- **Text size:** body text raised to 9.8 / 10.5 / 11 pt (compact / balanced / airy).
- **Empty side column on continuation pages (Vivid, confirmed):** pages after the side column's content now switch to full width; the planner measures each block at both widths. Applies to all side-column designs.
- **Space allocation:** Atelier sidebar narrowed (≈ 37% → 33% of the page) and portrait/header reduced; Ledger label column 27% → 22%; Halo and Meridian headers compacted; Sprout's side panel now fits its content instead of the full page.
- **Folio:** emails/URLs break only after "@" or "/" (never "example." | "com"); upright profile text; plain skills list.
- **Heritage:** profile left-aligned for scanning; balanced line breaks in expertise.
- **Chronicle:** stacked dates read as a range ("Sep 2020 –" / "Present"); larger contact text.
- **Lone words on new lines** (e.g. "(B)"): balanced headings and "pretty" paragraph wrapping everywhere.
- **Sample content:** engineer bullets no longer repeat across roles.
- **Driver preset:** licences now come right after the profile (employers check them first).

**Not accepted (with reason):**
- *Section order complaints (Clarity licences, Ledger skills on page 2):* that is the CV's content order, which users control; only the driver default was changed.
- *Unused space on short one-page CVs:* reflects short content, not the layout (partly mitigated by larger text).
- *Ink-heavy sidebars/bands, pills and chips, "interface feel" of Sprout:* these are the deliberate identities of those designs; users who want restraint have Clarity, Chronicle and Heritage.
- *"Continued" labels on page 2:* uncommon in CVs; the running header already names the candidate.
- *Robustness "unproven":* the reviewer saw 10 PDFs; the QA harness renders 170 combinations, including a 60-character name, very long emails/URLs, a name-only CV, 3-page careers, Letter paper and photos. Stress PDFs are now delivered with the samples.

**Still open (valid, not yet done):** Real-photo cropping has only been tested with illustrations. *(PDF tagging was re-checked on 2026-11-12: current Chrome produces a tagged PDF with the CV's language, the name as title, H1/H2 headings, lists and links; the remaining "NonStruct" nodes are layout wrappers. The parity tests now assert this for every design.)*

**Revised self-assessment:** our earlier 9.5 scores were too generous; the reviewer's average (7.8) was closer to the truth for those exports. After these fixes our estimate is **8.3–9.0** depending on the design (Chronicle, Clarity, Heritage, Ledger highest). The next step to justify 9+ is another independent review of the new PDFs, ideally with real job seekers.

**Verification:** 60 unit tests; 141 e2e tests (incl. 103 parity checks and 10 new reading-order + link checks); `qa:templates` 170/170.

## Phase 3d — response to the second independent review

Second review: collection ≈ 8.5/10 (Clarity 8.8, Ledger 8.7, Halo 8.7, Folio 8.6, Meridian 8.6, Vivid 8.5, Atelier 8.4, Sprout 8.4, Chronicle 8.2, Heritage 8.1). All five priority points were verified in the PDFs and accepted.

1. **Near-empty extra pages (Chronicle graduate, Heritage executive — a regression from the larger text):** the paginator now runs a bounded *fit* pass when the last page would hold < 30% content: up to two steps of tighter section/entry gaps (−20%/−38%), margins (−8%/−16%) and line height (−0.03/−0.06). Text size and section order are never changed; the page is only removed if everything fits with zero overflow. Both cases are now one page (e2e regression test).
2. **Oversized side-column groups (Atelier, Vivid, Sprout extreme):** skill groups longer than 8 split into chunks of 6 at item boundaries; the label stays with the first chunk; chunks are independent for pagination (an earlier rule that glued ≤ 4 list blocks together had re-joined them). e2e test checks "Skill 1" is on page 1.
3. **Continuation header (Clarity extreme):** every running header now has a guaranteed 2.5em gap and wraps (stacks) when name + role don't fit.
4. **Links beyond the header:** project URLs are now PDF links (e2e checks `github.com/dokafor/tokenbucket`).
5. **Meridian continuation sidebar:** on continuation pages the tint ends with the side-column content instead of filling the page.

Also from the review: protected gap above the page number (+2.5 mm bottom space on every page); Sprout dates move under long titles instead of squeezing them; Halo and Folio dates/details slightly larger and darker.

**Evidence provided this time:** samples, stress tests and US Letter exports (teacher, engineer, extreme) for all 10 designs. With the current type sizes the longest fixture is 2 pages; no fixture produces 3 pages any more.

**Verification:** 60 unit tests; 144 e2e tests; `qa:templates` 190 renders (A4 ± photo, Letter): no overflow, no near-empty last page, no Type 3 fonts.

## Phase 3e — response to the third independent review (collection ≈ 8.9/10)

1. **Clarity continuation header (valid — our bug):** the v3 rule targeted the running-header wrapper instead of its row, so it never applied. Fixed (`[data-slot="running"] > *`); e2e now measures the name/role gap for every design on the extreme CV (≥ 12 px or stacked).
2. **Light second pages on Letter (partly accepted):** measured last-page fill: Chronicle 38%, Heritage 32% (normal two-page CVs), Clarity 19%, Ledger 17% (fit pass cannot remove the page without overflow). Moving whole sections to page 2 was declined: it only moves the empty space to the bottom of page 1, which review 1 penalised. Instead the editor's "Fit on one page" prompt now appears whenever the last page is under 25% full (was 12%), leaving the choice to the user.
3. **Ordinary jobs split across pages (valid):** entries with ≤ 6 bullets now always stay whole; longer entries still split between bullets. New e2e invariant: no continuation page in any design (A4 + Letter, 4 CVs) starts with stray bullets — confirmed it fails on the old behaviour (Vivid × engineer × Letter).

**Templates are considered final for now.** Lessons from all audits and reviews are captured in `engineering/template-authoring-guide.md` (budgets, engine guarantees, coding rules, release checklist) — read it before creating any new template.

## Phase 4 report — AI assistance (Gemini)

**Provider decision:** the owner has a Gemini key, so Gemini replaced Anthropic as the first live adapter (ADR-0006). The provider interface, tasks and guard are unchanged in design; Anthropic stays a later one-file addition.

**Completed:**
- `src/modules/ai/`:
  - `schemas.ts`: input/output contracts for the six tasks.
  - `tasks.ts`: versioned prompts, model tier, finalize/guard per task.
  - `guard.ts`: truth guard. Numbers, number words, years, names and credentials absent from the person's text become `{{?…}}`. Years of experience derived from the person's dates are allowed.
  - `run.ts`:
    - Validates input.
    - One retry on 429/5xx, 20 s timeout.
    - Validates output with Zod and makes one repair attempt.
    - Applies the guard.
    - Never throws.
  - `providers/gemini.ts`:
    - REST `generateContent` with `responseJsonSchema`, falling back to plain JSON mode if the schema field is rejected.
    - Key sent in the `x-goog-api-key` header.
    - Thought parts ignored; safety blocks mapped.
  - `providers/mock.ts`: deterministic, labelled "Demo AI".
  - `config.ts`: the provider is never mock in production unless explicitly set; AI is off without a key.
  - `limits.ts`: 30 per 10 min and 150 per day per IP+device, plus a global daily budget kill switch.
- API:
  - `POST /api/ai/:task`: error envelope; logs contain no user text.
  - `GET /api/ai/status`.
  - Health check reports the AI mode.
- UI:
  - "Describe what you need" on Start: creates the CV with the chosen profession, title and design.
  - "Help me write" on the profile (write / improve / shorter) and on job, project and volunteering points (clearer / shorter / professional / turn text or notes into points).
  - "Suggest skills for me": the person picks; nothing is added automatically.
  - "Describe a style" on the Design tab: three choices from the catalogue, applied with undo.
  - Suggestion card with Use this · Try again (max 5) · Dismiss. Nothing changes until "Use this", and every use is one undo step.
  - `{{?…}}` markers highlighted in the editor hint, the suggestion card, the preview and the PDF, and flagged by the download checklist.
  - Per-device AI on/off switch: "Turn off AI help" in every AI menu, and a toggle on the Privacy page.
- Privacy page and Help updated to describe Gemini accurately.
- Scripts:
  - `npm run ai:eval`: live evaluation, 48 samples over 6 fixtures, messy notes and the brief's two examples. Writes a review log and runs an independent residual-fact check.
  - `npm run check:secrets`: fails if the key, the key's name, the Gemini host or prompt text appears in client files.

**Bug found and fixed (pre-existing):**
- **Symptom:** after an undo back to the exact previous document, the preview stayed on the newer version.
- **Cause:** the hidden frame already held that identical HTML, so it never reloaded or reported ready.
- **Fix:** the preview re-activates a ready frame that holds the same document.
- **Regression test:** `builder.spec` "undo back to an earlier design…". Confirmed failing on the old code.

**Verification:**
- `npm run verify`: lint, types, format, 97 unit tests (37 new AI tests: guard, runner, Gemini adapter with fetch mocks, mock provider, config, limits, marker rendering) and build.
- `npm run test:e2e`: 173 passed, 0 failed.
  - New `e2e/ai.spec.ts` covers Start describe (both brief examples), profile write/use/undo/redo with the marker in the preview and the checklist, bullets improve/try again/dismiss, notes→points, skills picking, describe a style with axe, and AI on/off.
  - Failure paths: unavailable, timeout, invalid output, rate limit and network failure. Each shows a friendly message and the field stays editable.
- `GEMINI_API_KEY=<sentinel> npm run build && npm run check:secrets`: no key or server AI code in 31 client files.
- `npm run ai:eval -- --mock`: 48/48 samples, pipeline OK. This is a dry run and says nothing about Gemini quality.
- Visual review of Start, the suggestion cards, describe a style, the preview markers and mobile.

**Acceptance status (roadmap Phase 4):**
1. Mock e2e including failure paths — ✅
2. Truth-guard unit tests — ✅
3. ≥ 30 live samples with 0 invented facts — ⏳ **not yet run.** This workspace cannot reach Google's API (blocked by its network allowlist), so the Gemini adapter is tested only against recorded API shapes. Run `GEMINI_API_KEY=… npm run ai:eval`, review `artifacts/ai-eval/*.md`, and record the result here.
4. Brief's two examples give sensible, valid specs — ✅ with the mock (teacher → blue + elegant font; driver → driver preset, "Delivery Driver", Clarity). ⏳ to confirm with Gemini in the same eval run.
5. No key in the client bundle — ✅

**Open launch items:**
- The Gemini key must belong to a Cloud project **with billing enabled** (paid-service data terms). Otherwise the privacy page is wrong (ADR-0006).
- Gemini terms require users to be 18+; decide how to handle the student / school-leaver audience before launch.
- Rate limits are in memory per instance; move to a shared store when running more than one instance.

## Release 1 progress

- **R1.1 Identity and cloud documents: built and verified locally (2026-11-12).** Includes:
  - Email/password sign-in (password rules, 18+ confirmation, verification, reset) and Google sign-in.
  - httpOnly server sessions and the account page.
  - Cloud documents with sync and version history.
  - Device CVs move into the account on sign-in; signing out removes them from the device.
  - Verification: 104 unit tests (store and sync, including the two-devices conflict case) and 182 e2e tests, all passing. The new `account.spec` covers the visitor→account move, a second and a third device, edit sync, sign-out cleanup, deletion sync, sign-in for accounts that existed before the redesign, and refused APIs.
  - **Verified on aicvstudio.app with production Firestore (2026-11-12, owner's admin account, session created by the owner):**
    - `/api/me` shows the old app's `admin` claim.
    - A new CV reached Firestore within seconds.
    - With the local copy removed, the CV was restored from the account and opened in the editor.
    - An edit synced, and the previous version was kept in `versions`.
    - Deleting the CV wrote a tombstone and removed the local copy.
    - No warnings or errors in the Cloud Run logs.
- **R1.2 Entitlement gate and config — built and verified locally (2026-11-12).**
  - **Typed `BusinessConfig`** (`src/modules/billing/config.ts`):
    - plans with monthly limits per capability,
    - design catalogue (enabled, free or premium tier),
    - passes,
    - feature switches (ai, import, sales, signups, maintenance),
    - announcement.
    It is stored in `config/business` with version history and cached for 60 s on the server.
  - **The gate:**
    - Pure `canUse` / `canUseDesign` decisions.
    - Server-side `reserve` / `release`: atomic monthly counters in `usage/{uid}_{yyyy-mm}`, counted on success only.
    - Premium passes in `passes/{uid}`.
    - Wired into `/api/pdf` (design tier, then download allowance) and `/api/ai/*` (Premium AI allowance).
    - `/api/me/entitlements` serves the display.
  - **UI:**
    - The download page asks visitors to sign in.
    - Free users see "N of M downloads left" and a limit banner.
    - A Premium-design card offers "Use a free design instead", which keeps the words.
    - Premium badges in the design picker; disabled designs are hidden.
    - Plan and usage on the account page.
    - AI refusals offer Sign in or See Premium.
    - Print is only a fallback, for allowed designs.
    - All Premium offers stay hidden until `features.sales` is on.
  - **Production starting config (defaults):**
    - Downloads need an account; free accounts get 30 a month.
    - All designs are free.
    - AI is Premium-only (and still paused by `AI_PROVIDER=off`).
    - Sales are off until R1.4.
  - **Tests:** 109 unit tests, plus `entitlements.spec`: visitor, free limit, Premium-design gate, crafted requests refused, failed AI not counted, Premium usage counted. Every e2e test now runs as its own fresh account (`e2e/support/test.ts`), and the full suite passes.
  - **Live on aicvstudio.app (2026-11-12):** `/api/me/entitlements` answers from production config.
- **R1.3 Admin Console v1 — built, deployed and verified on production (2026-11-12).**
  - **`/admin`**, for accounts with the `admin` claim (checked by the server on every call):
    - **Overview:** accounts, active Premium, this month's downloads and AI actions, switches, recently active users.
    - **Users:** find by email; grant or extend Premium (7/30/90/365 days), remove Premium, reset this month's usage, block or allow sign-in.
    - **Settings:**
      - Plan limits per month.
      - Design catalogue: shown or hidden, free or Premium, "new" mark.
      - Premium passes and prices.
      - Switches: sales, AI, import, sign-ups, maintenance.
      - Site-wide announcement.
    - Save is refused if someone else saved in between (version check). At least one design must stay free and shown.
    - **History & audit:** every settings version, with restore; every admin action with a readable diff.
  - **Switches now enforced:**
    - Maintenance pauses all metered actions and shows a notice.
    - Paused sign-ups refuse new accounts at session creation; existing accounts and admins still sign in.
    - The announcement shows on every site page.
  - **Firestore layout:** `passes/{uid}`, `usage/{uid}_{month}`, `config/business` (+ `versions`), `adminAudit`. All access is server-side.
  - **Tests:**
    - 113 unit tests (diff summary, maintenance).
    - `e2e/admin.spec` (8 tests incl. axe on all four pages) runs in its own Playwright project after all others, because it changes site-wide settings.
    - Full suite: 201 passed, 0 failed (127 skipped are the existing desktop-only/mobile-only cases).
  - **Production check with the owner's admin session:**
    - All admin endpoints return 200 and the pages render.
    - Granting 7 days of Premium to the admin account made `/api/me/entitlements` report Premium at once; removing it returned Free.
    - Both actions are in the audit log.
- **R1.4 Get Premium (manual payments) — built, deployed and live (2026-11-12); sales still closed.**
  - **`/premium`** (benchmarked against the pricing pages of leading CV builders, but honest):
    - Free vs Premium comparison built from live settings.
    - Pass cards with "Best value" and per-month price.
    - Payment details with a copy button on every line.
    - "Tell us you've paid" with the transaction ID.
    - Waiting and rejected (with reason) states.
    - FAQ: one-off pass, no auto-renewal, what happens when it ends.
    - AI is shown as "Coming soon" while the AI server is off.
    - Visitors are asked to sign in. While sales are off the page says "Premium opens soon".
  - **Server:**
    - `POST /api/premium/request`: signed-in users only, while sales are on, one pending request at a time, rate-limited. Only passes and methods shown on the page are accepted.
    - **Admin Payments:** approve or reject (reject needs a reason the buyer sees). Approval is transactional and can happen only once; it grants the pass or extends it from its current end, and is audited with the reference.
    - Settings refuse to open sales without an active pass and a shown payment method.
  - **Firestore:** `paymentRequests/{auto}` (equality queries only, no composite indexes needed).
  - **Tests:**
    - 115 unit tests.
    - `e2e/premium.spec` (5 tests: sales closed, visitor, buy → approve → Premium, reject → retry, sales guard, axe).
    - Full suite: 206 passed, 0 failed.
  - **Production:** `/api/premium`, `/api/admin/payments` and the Overview pending count return 200 with production Firestore.
  - **To open sales (owner):**
    1. Admin Console → Settings → How to pay: add the real bank, JazzCash or Easypaisa details.
    2. Check pass prices.
    3. Optionally set the launch design tiers (Clarity, Chronicle and Heritage free; the rest Premium).
    4. Tick "Premium sales are open" and save.
- **R1.5 Import an existing CV — built, deployed and verified on production (2026-11-12).**
  - **`/cv/import`** (linked from Start and My CVs):
    - Drop a PDF or Word (.docx) file, up to 5 MB.
    - "What we found" report and a live preview of the person's own CV in any design.
    - "Open in the editor" saves it to the account.
    - Visitors are asked to sign in. The monthly allowance shows; an import counts only when it succeeds.
  - **Reading:**
    - The server checks the file type by its bytes, reads it in memory and never stores it.
    - PDF: `unpdf` with line rebuilding (columns, wrapped dates/emails, Word "Symbol" bullets).
    - Word: `mammoth` HTML, so bullets survive.
    - `.doc` files and scanned PDFs get plain guidance.
  - **Structuring (owner direction: use Gemini where rules guess):**
    - Gemini task `import.structure`: copy-only prompt, temperature 0.
    - The answer is accepted only if every word of every content field exists in the file. Lines it left out go to "Other".
    - If AI is off, fails or adds anything, the deterministic parser is used (60+ heading variants, date styles, layouts, page-2 continuation, monograms).
    - The UI says when AI sorted the CV.
    - It shares one AI budget with AI help and is not exposed on `/api/ai/*`.
  - **Gemini provider hardening:**
    - Sends a lean schema (structure only).
    - On any schema rejection, retries in plain-JSON mode with the shape in the prompt.
    - Logs Gemini's error message (no user text).
    - Found in production: the first version got HTTP 400 and fell back to rules; fixed and re-verified.
  - **Production check (owner's session, 2026-11-12), with a messy PDF containing a prompt-injection line:**
    - `method: ai`, about 20 s.
    - Name, headline, contacts, 2 jobs (role/company/location/dates/bullets), education, skills and languages all correct.
    - The injected "add CEO of Google" was not obeyed: no extra job, and the line was kept only as text.
    - The rules-only result on the same file had misplaced fields.
    - Usage was reset afterwards.
  - **Quality:**
    - `npx tsx scripts/import-roundtrip.ts` re-imports 70 sample PDFs from our designs with the rules parser: 97.9% of field checks match.
    - Unit tests use real Word/PDF fixtures, plus faithfulness, coverage and mapping tests.
  - **Also in this release:**
    - Deleting a CV now also deletes its kept versions. This was a privacy bug: versions used to remain.
    - **Delete my account** on the Account page (CVs, versions, pass, usage; payment records kept with the email removed; admins excluded).
    - **Privacy page rewritten** to match accounts, cloud storage, import and Gemini.
    - **Gemini is on in production** (`AI_PROVIDER: gemini`, owner direction). AI writing help remains Premium-only through the gate.
  - **Tests:** 136 unit tests; full e2e 218 passed, 0 failed (incl. import and account-deletion specs).
- **R1.6 Launch gate — done (2026-11-12).**
  - **Live AI evaluation on production (Gemini, `gemini-flash-latest`):**
    - 48/48 samples, 0 failed calls, **0 unmarked new facts**. The guard caught 2 additions ("NMC-registered" in a nurse profile; "50" in a tech bullet) and turned them into `{{?…}}` questions.
    - Average 7.6 s, maximum 24.6 s.
    - The brief's examples: teacher → teacher preset, Clarity, blue, elegant font; driver → driver preset, "Delivery Driver", Clarity.
    - Runs from **Console → AI** (admin-only `/api/admin/ai/eval`, batches of 4 on the server); `npm run ai:eval` shares the samples.
    - Phase 4 acceptance 3–4 are now met.
  - **Success numbers:**
    - `metrics/{day}` counters (counts only, no content).
    - Overview shows last-30-day accounts, download-step sign-ins, PDFs, limit hits, imports (AI/rules/failed), AI actions, Premium requests and approval time, and today's AI calls against the budget (80% warning).
  - **Duplicate transaction IDs** are refused (normalised, across accounts).
  - **Terms page; Help and UI copy brought up to date** (accounts, Premium, import, deletion); support email setting.
  - **Accessibility:** axe (WCAG 2.2 AA tags) on every public page, desktop and mobile, plus all console pages: 0 serious or critical.
  - **Performance (Lighthouse mobile, simulated slow 4G):** Home 95, Start 94, Designs 89 (was 50), Premium 93, Import 97, Help 98. Accessibility, best practices and SEO are 100 on all.
    - Fixes: preview reserves its aspect ratio (layout shift 0.39 → 0); lazy gallery previews (TBT 680 → 60 ms); prioritised thumbnails; favicon.
  - **GitHub CI is green for the first time.** Earlier runs had been failing unnoticed: formatting outside `src`, and a real preview/PDF page-count mismatch.
    - The paginator now accepts a tightened fit only with 14 px to spare per column.
    - CI previews in real Chrome and adds a parity run against the production PDF renderer (`PDF_BROWSER=bundled`).
    - CI runs on `main`, `develop` and release branches.
  - **Staging:**
    - Backend `aicvstudio-staging` (europe-west4) deploys from `develop`: https://aicvstudio-staging--ai-cv-studio.europe-west4.hosted.app.
    - Separate Firestore database `staging` (restrictive rules, nam5); environment `staging` with `apphosting.staging.yaml` (AI budget 200, max 1 instance).
    - The first rollout succeeded; health is ok.
    - Google sign-in on the staging domain needs it added to Firebase Auth authorised domains; email sign-in works as is.
  - **Alerts:** Cloud Monitoring log alert "AI CV Studio production: server errors, 5xx or AI budget at 80%" (matches `jsonPayload.level="error"`, HTTP ≥ 500 or `ai_budget_80`). **No notification channel yet:** the owner adds an email channel in Monitoring → Alerting → Edit notification channels.
- Next: **Release 2 — Job-ready.**

## Release 2 — Job-ready (2026-11-12, live)

- **CV health check** (download page): specific "fix" and "improve" findings (missing contact details, empty or weak bullets, dates, length, page fit) with **Show me** links that open the editor on the exact field (`?focus=`). Replaces the old checklist.
- **Job tracker** (`/jobs`): board by stage (saved → applied → interview → offer, plus closed), stage select and drag-free moves, notes, applied date (stamped automatically), link the CVs used. Limits by plan: visitor 0, free 3, Premium unlimited (admin Settings → `maxJobs`).
- **Career profile** (`/profile`): one master record with everything; CVs are copies of it. Import can create it; the editor marks it.
- **Job match (Premium AI):** compares the chosen CV with the pasted advert.
  - Requirements are grouped as *You show this* / *Partly shown* / *Not in your CV*, each with quoted evidence and a **Show me** link.
  - The AI must cite numbered CV lines (`J1.B2`, `CERT1`…). The app resolves them to the person's own text and drops invented IDs. "Met" without evidence, or with only the headline or summary as evidence, becomes "Partly".
  - Keyword chips show found and missing terms, re-checked by the app (whole words, plural-tolerant), with a note to add only what's true.
- **Tailored CV (Premium AI):** a copy titled "Name — Job (Company)" with bullets and skills reordered for the job. Nothing is added or dropped. The headline and summary are rewritten under the truth guard. The copy is linked to the job and opens in the editor.
- **Cover letter (Premium AI):**
  - Warm or formal draft, guarded against new facts; anything uncertain is highlighted as `[confirm: …]`.
  - Editable greeting, paragraphs and sign-off, with a live preview in the CV's design (accent, fonts, paper size).
  - **PDF download** through the same renderer (counts as a PDF download).
- **Verification:**
  - **Unit tests:** 157, including match rules, tailoring that never adds or drops facts, and guard word families.
  - **Full e2e:** 249 passed, 0 failed, including `apply.spec` (match → letter → PDF → tailored CV, the Premium offer and 402 for free accounts, advert required) on desktop and mobile with axe.
  - **CI:** green (run for 42ec071).
  - **Live Gemini evaluation on production:** 57 samples now, 9 of them for the job tasks (driver, nurse and engineer adverts). The 9 job samples: 9/9 ok, **0 unmarked new facts**. Match results were accurate; letters were specific and used only CV facts.
  - Two guard false alarms found by this evaluation were fixed:
    - "NMC-registered" when the CV says "NMC registered nurse": hyphenated compounds whose parts are all in the CV now count as known.
    - "certification" when the CV says "Certified": credential word families now count as known.
  - Keywords are now limited to skills, tools and qualifications (`match@2`).
- **CI hardening found on the way:**
  - GitHub's `ubuntu-latest` moved to 26.04 (Chrome 156, poppler 26.01). There, three designs' job titles extracted without spaces ("CourierDriver"), which an applicant-tracking system could also misread. Fixed with slight word-spacing on heading-font job titles (verified on 26.04, including PDF parity). CI is pinned to `ubuntu-24.04` for reproducibility.
  - Admin and Premium e2e files now run on one worker, because they share site settings.

## Release 3 — Professional presence (2026-11-12)

- **Application email (completes R2):** the cover-letter draft now includes a short covering email (subject and body, guarded) with **Copy email** and **Open in my email app**.
- **Word (.docx) export** (download page, every signed-in plan):
  - One clean column with real Word headings, bullets and clickable links, so it reads well in Word, Google Docs and applicant-tracking systems.
  - Follows the CV's accent, paper size and heading style (serif → Georgia, otherwise Calibri).
  - Shares the monthly download allowance with PDFs; any design may be exported.
- **Share links:**
  - A private, unguessable (128-bit) read-only link to the latest version of a CV, created from the download page.
  - Shows how often it was opened; can be switched off and on, or deleted.
  - The public page `/s/{token}` is hidden from search engines and offers print / save as PDF.
  - Links are removed with the CV and with the account.
- **LinkedIn profile writer** (Premium, `/linkedin`):
  - Headline, About section, a description per job and the top skills, all written from the chosen CV and guarded.
  - Job IDs and skills are checked against the CV.
  - Editable, with Copy buttons and LinkedIn's character limits; the result is kept in this browser.
- **Portfolio page** (Premium):
  - `/portfolio` sets the address `aicvstudio.app/p/{slug}`. Addresses are checked for format, reserved words, and being taken by someone else (409).
  - Settings: which CV, whether to show email and phone (both off by default), published.
  - The page is responsive, uses the CV's accent (forced to readable contrast) and heading style, is indexable with Open Graph tags, and counts visits.
  - It goes offline if the owner's Premium ends, the CV is deleted, or it is unpublished.
- **My CVs** links to the portfolio and LinkedIn writer. The **privacy page** now covers Word files, job and LinkedIn AI, share links and portfolios.
- **Live evaluation:** 60 samples (adds LinkedIn for three professions).
  - Production run on 2026-11-12, before the LinkedIn samples existed: no failed calls and no unmarked new facts, average 7.7 s.
  - Guard false alarms found and fixed:
    - compound words ("NMC-registered", "AWS-based");
    - credential word families ("Certified" → "certification");
    - CV sections implying their kind (a listed certificate is a certification);
    - letter salutations;
    - a sentence-opening "A" joined to a flagged name.
- **Tests:** 164 unit tests; full e2e 265 passed, 0 failed (new: `share`, `portfolio`, `linkedin`, and Word in `entitlements`).

- **Production verification of R3 (2026-11-12):** run on the owner's account with a temporary CV, deleted afterwards and usage reset to 0.
  - The Word download is a valid .docx.
  - The share link works when on, gives 404 when off and again after the CV is deleted, and the page is noindex.
  - A free account is refused the portfolio (402).
  - Live LinkedIn samples: 3/3, no unmarked facts.
  - Found and fixed: visit counters (and every `track()` metric) are now awaited before responding, because Cloud Run can drop work left running after the response.

## Release 4 — Growth (2026-11-12)

- **Interview preparation** (Premium AI, on each job):
  - 8 likely questions for that job, each with what it's testing, answer notes from the CV (linked to the source lines), honest answers for gaps, and tips.
  - The person's own notes are saved per question.
  - Covered by the live evaluation (63 samples).
- **Discount codes** (Admin → Settings → Discount codes):
  - Each code sets % off and/or extra days, which passes it applies to, a use limit (pending and approved purchases count) and a last day.
  - Buyers enter the code on the Premium page and see the new price.
  - The server prices every purchase itself, never trusting the browser.
  - The admin sees the code and the list price on each payment.
- **Invite rewards** (Admin → Settings → Invite friends, off by default):
  - Each account gets a link `/r/{code}` on its Account page (shown while sales are on).
  - A friend who signs up through it gets extra days on their first pass.
  - When that pass is approved, the inviter gets Premium days. This is audited (`referral.reward`) and counted.
  - Self-invites and repeat rewards are prevented. The Terms explain the rules.
- **Admin overview** now also shows Word downloads, share and portfolio opens, invites, rewards and codes used.
- **Deferred:**
  - Card gateway: waits for business registration.
  - Urdu: waits for demand.
- **Tests:** 171 unit tests; full e2e 270 passed, 0 failed; CI green.
- **Production verification (2026-11-12):**
  - New routes live; quotes are refused while sales are closed; invites are hidden while off.
  - Live interview samples: 3/3, no unmarked facts.
  - Found and fixed:
    - The invite link redirected to App Hosting's internal host; it now uses a relative redirect.
    - Quoted questions in tips were flagged as names.

## After R4 (2026-11-12)

- **Order-number checkout (owner request):**
  - The buyer gives their mobile number and places an order. They get an order number (`CV-XXXXXX`) and a WhatsApp button, prefilled with the order and amount, to send the payment screenshot to the owner's number (Settings → How to pay).
  - The transaction ID is optional.
  - Admin → Payments shows the order number, mobile number and a WhatsApp link.
  - The support email now appears on the Premium page.
- **Cancel an unpaid order:**
  - Buyers can cancel their own waiting order and place a new one; before this, an unpaid order blocked them until the owner rejected it.
  - Cancelled orders show as "Cancelled by buyer" and don't count towards discount-code limits or invite rewards.
- **Shared daily AI budget:** the site-wide budget is now checked against the shared daily counters (20 s cache), so it holds with up to 4 production instances. Burst limits stay per instance, and monthly allowances were already shared.
- **Accessible PDFs:** confirmed and now tested in the parity tests (see Phase 3c note).
- **Tests:** 172 unit tests; full e2e 271 passed, 0 failed.
- **Production:** sales are open (EasyPaisa, support email and WhatsApp number set by the owner on 2026-11-12).

## Release 5 — Instant Makeover (2026-11-13)

Spec: `docs/product/complete-studio-spec.md` §6 and §16 (R5). Owner decisions in Appendix C.

- **The flow (`/makeover`, and the drop zone on the home page):**
  - Accepts PDF (text or scanned), Word `.docx` and old `.doc`, and photos (JPG, PNG, WebP, HEIC), up to 10 MB and 10 pages. The type is detected from the bytes.
  - Progress view, then the reveal: the original under the new CV with a before/after slider, and a strip of 6 designs rendered with the person's own content.
  - No sign-in needed to see the result. Download or save asks a visitor to create an account; the result is kept in the browser through sign-up and saved automatically when they return.
  - `/cv/import` now redirects to `/makeover` (the old import screen was removed). The `/api/import` API stays and uses the same reading pipeline.
- **Server (`src/modules/import/pipeline.ts`):** extract text → vision for scans and photos (`import.transcribe`, the file sent to Gemini as inline data) → `import.structure` (copy-only, verified) or the rules → coverage check (`import/coverage.ts`, distinct content words, target 97%). The AI steps share a 55-second time budget so a request never hits the host's time limit.
- **Profession (`makeover/profile.ts`):** rules first, as the spec allows: weighted keywords over headline, job titles and summary, plus years from the dates. No AI call.
- **Ranking (`makeover/rank.ts`):** a pure, tested score per design (profession 0–40, length 0–20, photo 0–15, density 0–15). The six always include a single-column, a side-column and a bold design. The pre-selected design is the best one the person can download.
- **Polish chips (`makeover/polish.ts`, `/api/makeover/polish`, task `makeover.diagnose`):**
  - Counts are worked out without AI. Suggestions are fetched only when a chip is opened, shown as before/after pairs, and applied only when accepted.
  - Every suggestion passes the truth guard. A suggestion with an unsupported number, name or credential is dropped, never shown (tested end to end with an injected "45%").
  - "Fix wording" is free once per makeover. "Strengthen bullets" and later wording checks are AI actions (Premium). "Fill gaps" asks for missing contact details inline and lists the rest for the editor.
- **Allowances:**
  - A signed-in account with imports left gets a full makeover; one `import.cv` use is counted at the reveal.
  - A visitor gets a preview (3 a day per network address); one import is counted when it is saved after sign-up (`/api/makeover/claim`).
  - An account over its monthly imports gets one preview a day, watermarked, which cannot be saved.
  - The server keeps only counters per makeover (`usage/mk_<id>_polish`), never CV content. Crafted claim and polish requests are refused (tested).
- **Buyer emails (`src/modules/notify/`):** approving or rejecting an order emails the buyer (order number, end date or reason). Admin → Settings shows whether email is on and can send a test email. SMTP through Namecheap Private Email; skipped and logged until the owner sets the mailbox password (see Owner to-do).
- **Firestore rules:** `firestore.rules` denies all browser access to every studio collection (the server uses the Admin SDK). `npm run test:rules` checks it in the Firestore emulator; it runs in CI. Deploying the rules is an owner step, because the project is shared with career-os.
- **Funnel:** Admin overview shows home page visits → uploads → reveals → saved, plus previews, failures, scans read, design switches and polish checks. AI vision and polish calls count towards the daily AI budget.
- **Privacy and Help pages** describe photo and scan reading and the polish suggestions.
- **Deviations from the spec (recorded):**
  - The "before" view is drawn in the browser (PDF page 1, the photo, or the Word file's text). Nothing is stored on the server, so it is not shown after the sign-in round trip.
  - Progress steps move on a timer while the single request runs, and are completed when the answer arrives.
  - A photo in the original is not cropped out and offered yet (it needs image coordinates). Planned with the R6 engine work.
  - Unplaced lines get "Add to my CV" and "Leave out" buttons instead of drag targets.
- **Tests:**
  - 198 unit tests: ranking and the variety rule on every fixture, profile detection, coverage, polish addressing, vision and diagnose tasks with the mock, notify emails, `.doc`/scan/photo detection.
  - Synthetic corpus in `src/modules/import/__fixtures__`: Word `.docx` and `.doc`, text PDF, two-column PDF, scanned PDF, JPG and PNG photos, and a CV with wording problems.
  - e2e `makeover.spec.ts`: home page drop → reveal with 6 designs and 3 layout families; before/after slider; design switch; a visitor's makeover survives sign-up and appears on another device in the chosen design; scans and photos; allowance and watermark; free wording polish; the invented fact is never shown; Premium-only bullets; crafted requests refused. Buyer email checked in `premium.spec.ts`.
  - Full e2e: 284 passed, 0 failed.
- **Verified on production (2026-11-13, real Gemini):**
  - Home page shows the drop zone; `/makeover` loads; `/cv/import` redirects.
  - A photographed CV (image only, no text layer) sent as a visitor: read by Gemini vision in 18 s; name, email and phone correct; 3 sections; coverage 100%; profession healthcare; 6 designs ranked (Meridian first); visitor preview mode.
  - "Fix wording" with real Gemini: fixed "i", "recieved", "Responsable" and kept every fact; a second free call was refused (sign-in needed).
  - Internal AI tasks are refused on the public AI route; the Admin overview funnel counts the makeover; email shows "off" until the mailbox password is set.
  - CI green on the branch, `develop` and `main`, including the Firestore rules emulator test.
- **Left for the owner (spec §6.6 human parts):** the 40 real CVs (10 Word, 10 builder PDFs, 10 two-column, 5 scans, 5 phone photos) and the timing measurements on production.

## Release 6 — Design engine (2026-11-13)

Spec: `docs/product/complete-studio-spec.md` §7 and §16 (R6), Appendix A.

- **Design Spec v2** (`src/modules/design/spec.ts`): the whole design vocabulary as a Zod schema. Every field is an enum or a clamped number with a default; unknown values fall back instead of failing, so nothing the AI or a person sends can break the composer.
- **The 10 designs as specs** (`design/catalogue.ts`): each is a spec *attached* to its hand-crafted signature code (`baseId`). While attached, only the choices the old Design panel offered apply (colour, font, spacing, paper, name position, skills style, photo), and the output is the catalogue design itself. Changing any other choice *detaches* it: the generic composer then renders it from the spec, which describes the same design in the generic vocabulary.
- **Migration** (`migrateV1` / `toV1`): v1 design settings ↔ v2 spec. The document schema gains an optional `design.v2`; the v1 fields are kept in step, so stored CVs, Word export, letters and portfolio pages keep working without a data migration.
- **normalise()** (`design/normalise.ts`), the hard rules of §7.6:
  - long sections out of narrow columns;
  - column widths (side 24–40%, rails 20–27%);
  - no skill bars or dots without levels;
  - at most two colours plus ink;
  - signature artwork only on its own design;
  - text at least 9.5 pt;
  - photo and header options that need a side column;
  - **ATS-safe version** (one plain column, standard headings, no art or icons, inline contact; the person's other choices are kept and come back when it is switched off).
- **Composer** (`design/compose.tsx`): spec → the same TemplateDefinition the engine already uses, so pagination, preview, PDF and parity are unchanged. It covers:
  - 7 layouts, including **rails (three columns)** and keep-columns;
  - 7 header styles with band variants, name size/case/weight/two-tone/tracking, headline, and 3 contact layouts with icons;
  - photo shape, size, position and ring;
  - 9 heading styles, 4 section containers and 5 dividers;
  - 4 entry layouts, organisation-first, and 3 date formats;
  - 8 bullet markers;
  - skills as tags, inline, columns or one per line;
  - mono, accent and duo colour, 3 ink colours, 3 paper colours;
  - 6 decorations, section icons, page numbers, running header and footer;
  - a QR code (to the person's own portfolio or LinkedIn link) and a references line.

  No person text is ever written into CSS.
- **Paginator:** a third column (`data-flow="third"`) and keep-columns. Existing designs lay out exactly as before (the parity suite is unchanged).
- **Design Studio** (Design tab, behind the Admin switch **Settings → Switches → Design Studio**, off by default):
  - **Adjust (level 2):** layout, header, colours, headings, bullets/dates/skills, spacing and lines, extras.
  - **Fine-tune (level 3):** margins, text size, line spacing, gaps, side width, and where each section goes (main, side or right column).
  - "Based on X" or "Your own design", with **Back to X**.
  - **ATS-safe version** toggle.
  - **Fit to one page:** runs the repair steps and reports what it changed; undo puts it back.
  - **Save as my design:** up to 30 per account, under `users/{uid}/designs`, deleted with the account, and usable on any CV.
- **Premium:** downloading a custom (detached) design needs Premium, like the Designer decision. The ATS-safe version and all catalogue choices follow the existing rules. Free users can try everything in the preview, and the download page explains this.
- **Gates (all green):**
  - **Identical v1 → v2 migration:** the HTML of every catalogue design × every fixture × options (photo, Letter, densities, accent, fonts, name position, skills style) is byte-for-byte the same with the migrated spec, so it is pixel-identical.
  - **Property test:** 5,000 random specs × the 8 fixtures (unit). Each composes into a valid document with the text stream ordered header → main → side → third, the name first, nothing broken in the CSS, and the hard rules holding.
  - **Enum sweep** (one spec per value of every field, 104 specs): renders in unit tests, and lays out with **zero overflow in Chrome × 4 fixtures** (including the extreme and empty CVs).
  - **300 random specs** lay out in Chrome with zero overflow.
  - **PDF parity for 12 composed layouts × 2 fixtures:** PDF page count = preview page count, and the name is extracted before the first job.
  - **Studio e2e:** switch, detach and undo re-attach, ATS-safe, Fit to one page (2 → 1 page), saved designs on another CV, server-side spec cleaning, the Premium gate, and axe.
- **Verified on production (2026-11-13):**
  - Existing CVs open and render as before.
  - A composed design (ATS-safe version of a side-column band design) printed to a 1-page PDF in production Chromium.
  - A custom design is refused to a free account with the Premium message (402).
  - `/api/designs` answers.
  - The Design Studio switch was then turned on (owner approval). The Studio appeared in the Design tab, a change made the CV "Your own design", and undo returned it to "Based on Clarity".
  - **Found and fixed on the way:** the 10 design thumbnails (`/templates/*.webp`) had been returning 404 in production since launch. The standalone build ships only traced files: fonts are traced through the PDF renderer, but the thumbnails were not. They are now included, and CI fails if any `public/` file is missing from the standalone build. All 10 now load on aicvstudio.app.
  - After the screenshots: "Three columns" with an empty right column now shares the side sections across both columns, and the makeover says "an office" rather than "a office".
- **Screenshots** of the app are in `docs/screenshots/` (linked from the README).
  - CI green on the branch, then merged to `main` and `develop`.
- **Deviations from the spec (recorded):**
  - `templates/library/` is **kept** as the signature code of the attached catalogue designs instead of being deleted. A generic re-implementation could not be pixel-identical, and the spec's gate is the identical migration. New designs (R7) are pure specs.
  - Schema v2 is **additive** (`design.v2` beside the v1 fields), not a rename with a data migration: no risk to stored CVs.
  - Fonts stay as the 5 tested pairs (`type.pair`) until the catalogue grows in R7.
  - Property test sizes: 5,000 random specs in unit tests, 300 random specs plus the full enum sweep in the browser. 40,000 browser renders per CI run would take hours.
  - Header "in-sidebar" is drawn as a band above both columns (the name stays first in the text stream). Compact grids (`compactColumns`) are not applied to one-line items yet.
  - The level 2 pickers are labelled choice chips, not picture tiles. Picture tiles come with the R7 gallery.

## Look-back before R7 and the owner's real-CV test (2026-11-13)

**Test:** the owner's own CV (PDF) went through the live makeover with real Gemini; nothing was typed in by hand. It was then used to make an AI-tailored CV for each of two jobs (a .NET backend role in Austria, a remote database role). The CVs were looked at in all 10 designs, an AI "Describe a style" design, and Design Studio custom layouts (rails, timeline, ATS-safe).

**Data in the right place:**
- name, headline and contact details in the header;
- the summary in Profile;
- both jobs with dates, "current" and every bullet;
- education with its detail line;
- "Core strengths" and "Technical skills" as skill groups;
- languages with their fluency.

The match check found 8 of 9 requirements met. German was correctly marked "partly shown". The tailored copies kept the same bullets in a new order, with an honest new summary. The AI style suggestion ("technical, navy, skills in a side column") picked Meridian in navy, which fits.

**Bugs found and fixed (with tests):**
- Import put "Other" first and made a second "Other" holding the phone number. Now "Other" sections are merged, personal lines (nationality, date of birth…) go to a "Personal details" section, lines that only repeat a contact are dropped, and both sections go last.
- Language fluency was cut at 80 characters and skill keywords at 80. They are now 240 and 160.
- The makeover's before/after "before" layer was hidden behind the after layer.
- Non-standard section headings now get a health-check note ("Use the usual section names"); bilingual titles are accepted.
- A job's "Use this CV" picked the newest CV, even another job's tailored copy. It now prefers the career profile, then the newest untailored CV.
- **Pagination:** a first job with six long bullets was kept whole, which pushed the whole experience section to page 2 and left half of page 1 empty (seen in side-column and three-column designs). Entries now stay whole only when their bullets are also short (≤ 600 characters); longer ones break between bullets.
- Seen once live, not reproducible: after a layout change the preview kept a one-page frame for a two-page CV, cutting it off. Reloading fixed it. As a safety net, the preview loads a build again once if it has not reported within 5 seconds.

**Still open (not bugs, recorded for later):**
- R5:
  - no photo crop from the original CV;
  - the progress steps are timed, not real progress;
  - the "before" view is gone after the sign-in round trip;
  - unplaced lines use buttons, not drag targets;
  - no `makeover.profile` AI task (rules first);
  - only 1 of the 40 real CVs has been tried (owner to-do 9).
- R6:
  - compact grids (`compactColumns`) not applied;
  - level 2 uses chips, not picture tiles;
  - saved designs are not yet offered for letters and portfolio (spec §7.4) — planned in R7;
  - personal-details advice is not locale-aware (e.g. a date of birth is normal in Germany/Austria, discouraged in the UK/US).
- A very narrow rail with long language fluency text reads as a tall thin column; acceptable, but R7's gallery should prefer wider rails for wordy side sections.
- Test data left in the owner's account: CVs `k7rEckoI5a` (import), `Ht7QLfWwmE` and `abnIDQ_E21` (tailored), two test jobs, the old `verify-r3-…` doc and a "My CV (copy from this device)" duplicate. The owner can delete them from My CVs and Jobs.

## Release 7 — Describe your design (2026-11-13)

Spec: `docs/product/complete-studio-spec.md` §7.4, §7.7, §7.8, §8, §16 (R7).

- **Catalogue: 32 designs in 8 families of 4** (`src/modules/design/designs.ts`).
  - The 10 hand-crafted designs plus 22 new designs written as pure Design Specs.
  - Families: Clean, Classic, Sidebar, Editorial, Timeline, Bold, Portrait, Compact grid.
  - Designs in a family differ in layout, header, headings or decoration, never only in colour (unit-tested).
  - Each design has a family, columns, photo support and the kinds of work it suits (this drives the makeover ranking, which now covers all 32).
  - A spec design stays itself while only colour, font, spacing, paper or photo change (`designId`). A custom design remembers the design it started from ("Back to …").
  - Settings saved before R7 gain the new designs hidden and Premium, so nothing appears until switched on.
  - **Production:** all 22 switched on and marked new, with one free design per family (owner decision): Clarity, Heritage, Harbor, Column, Chronicle, Spark, Lens and Grid. Every design can still be changed in Admin → Settings → Designs (now showing each design's family).
- **Download rule** (`tierDesignId`, shared by the server and the download page): a catalogue design, or its ATS-safe version, follows that design's tier; a custom design needs Premium.
- **AI Designer** (switch: Admin → Settings → AI Designer).
  - **Design Studio level 1, "Describe the CV you imagine":**
    - example prompts per kind of work, and an optional picture of a CV you like;
    - three live designs of the person's own CV, with the fit-check repairs from spec §7.4 (side narrower and inline skills, then compact spacing and full width; a design that still overflows is replaced by the nearest catalogue design);
    - "Use this" is one undo step;
    - "Change something…" refines in words.
  - **`design.compose` and `design.refine`** work through one flat vocabulary (`design/vocab.ts`, 50 fields, each mapped to one spec path), used for the prompt, the output schema and refine patches. A patch can only change the fields it names (unit-tested over 500 random specs and patches).
  - Only content statistics go to the model, never CV text. Pictures are checked by their bytes and limited to 4 MB.
  - **Allowance `design.ai`:** Free gets one compose to try (designs made with it preview but need Premium to download); Premium gets 40 a month; refines are not counted. Designer calls count towards the daily AI budget.
  - The privacy page says what the Designer sends.
- **Gallery (`/templates`):** all 32 shown with your own CV, or a sample. Filters: family, columns, photo, kind of work, and "best for online applications". Each design has its own page (`/templates/[id]`) with all pages, the ATS-safe version, the matching cover letter and "Use this design".
- **Catalogue gates (`npm run gates:catalogue`, in CI):** every design × 8 fixtures in print-mode Chromium (256 renders), 0 failures. Checks:
  - zero overflow, and PDF page count equal to the layout;
  - fonts embedded, no Type 3;
  - top-third rule;
  - round trip through our own import: at least 97% coverage and the right employer for every job;
  - position-sorted extraction (`pdftotext -layout`) for single-column designs and every design's ATS-safe version.
  - The contrast gate (all text/background pairs at least 4.5:1, palette plus extreme colours, over every value of every field) is a unit test.
- **Real problems the new gates found, all fixed:**
  - arrow, chevron and tick bullets embedded a Type 3 font; they are now drawn shapes;
  - wide letter-spacing in Clarity's and Heritage's headings, and Chrome's fake small capitals, split words in text extraction ("W O R K", "W ork history");
  - the ATS-safe version's headings split words too;
  - the importer stole the previous job's last bullet when dates come first;
  - narrow three-column gaps joined columns on import;
  - "ʼ" apostrophes;
  - accent and second colours were too light on cream paper or tinted columns;
  - band headlines were too light; muted text was too light on solid side columns;
  - "filled" and "tinted" headings clashed (white text on a pale tint);
  - side fills touched the main column; an overlapping photo covered a centred name.
- **Another real bug found while testing:** a change made in the last 0.4 s before clicking Download was missing from the download page and the PDF. The page read the CV before the editor saved. Download and back now save first (regression test).
- **Verified on production (2026-11-13), real Gemini:**
  - **Designer evaluation** (Admin → AI, 69 samples):
    - 60/60 descriptions gave at least 2 valid designs;
    - 58/60 first designs matched every automatic check (97%; the bar is 85%);
    - refine 8/8 changed only the named settings, and the impossible request changed nothing;
    - the injection sample was ignored, giving a normal design and no HTML.
  - **Editor on the owner's CV:**
    - "Two columns, navy, skills on the left, square bullets" gave three navy two-column designs; "Use this" made it "Your own design, started from Harbor";
    - "make the sidebar narrower and the headings in coloured boxes" changed only those two settings (5.1 s).
- **Speed:** the first live median for a compose was 13.6 s, above the 8 s target. Design tasks now ask Gemini for minimal thinking (they pick from fixed values). **Re-measured on production after deploy: median compose 4.1 s, 90% within 5.6 s; with 1–2 s to draw the three previews, compose plus render is under 8 s.** Same run: 60/60 gave 2+ valid designs, 59/60 first designs matched every check (98%), refine 8/8 in 1.6–3.6 s, injection ignored. The misses were bullets the model mentioned but didn't set; the prompt now requires every requested detail in the choices (one such miss remains).
- **Deviations (recorded):**
  - Top-third rule: Vivid, Halo, Folio and Sprout (hand-crafted, outside-reviewed) reach 41–45% with the longer samples because of their signature portrait or two-tone headers; the gate allows them 46%. All other 28 designs meet 40%.
  - Label-margin designs (Ledger, Column, Press) count as multi-column for the position-sorted extraction check; their ATS-safe versions pass it.
  - The Design-tab picker shows static thumbnails of the 32 designs, filtered by family. The gallery shows them with the person's own CV.
  - Not built: sharing user designs in a Community shelf (R10, as planned).
- **Owner feedback (same day):** the thumbnails looked richer than the applied design. The cause was the typeface: thumbnails showed the sample CV's font (serif headings), while picking a design kept the CV's own font (plain sans). Fixed and live:
  - every design now has its own typeface — the one its thumbnail shows — and picking it applies it (still changeable under Font);
  - the Design-tab picker draws each card with the person's own CV (spec §7.7), over the static thumbnail;
  - thumbnails were regenerated through the same code path.
- **Owner to-do for R7:**
  - the 30-person blind preference test (target: ours preferred in 60% of pairings);
  - the outside reviewer's rubric scores for the 22 new designs (minimum 8.5 average).

## Release 8 — One studio (2026-11-13, live)

### R8.1 Studio shell and Home
- **Signed-in shell** (spec §11.1):
  - a left rail on desktop and a bottom bar on phones, with exactly five destinations: Home `/studio`, Documents `/documents`, Jobs, Presence `/presence` and Coach `/coach`;
  - a Create button that opens one sheet: Upload a CV, New CV, Cover letter, Add a job, Portfolio;
  - a profile menu with Career profile, My designs, Plan, Settings, Help, and Admin for admins;
  - Ctrl/Cmd+K: a command palette for pages, actions and documents by name.
- **Visitor top bar:** Templates · Features · Pricing · Sign in · Upload my CV · Start from scratch.
- **Inside a document:** the editor keeps its slim studio bar, with no shell.
- **One page tree for both chromes.** When sign-in finishes loading, the page stays mounted and keeps its state. The first version remounted the page, which lost a makeover upload made during loading; the e2e suite caught it.
- **Studio Home** (spec §11.2): Continue card, next best step, documents row, jobs pipeline, profile strength ring and Explore tiles.
  - The next best step comes from one pure function, `nextAction()` in `src/modules/studio/next-action.ts`, which has tests.
  - Every profile-strength item is a one-click fix link.
- **Moved routes:**
  - `/cv` redirects to `/documents`.
  - Sign-in now lands on `/studio`.
  - The editor's back link reads "Back to Documents".
  - `/jobs?new=1` opens the Add-a-job form; `/cv/{id}?tab=design` opens the Design tab.
- **Pages without empty screens:**
  - Presence links the portfolio and LinkedIn tools.
  - Coach lists your jobs with "Practise interview" and "Check my match", or asks you to add a job (the coach chat comes in R9).
- **Fixed bars and toasts** (job detail, admin settings) sit clear of the rail and the phone bottom bar, using `--shell-left` and `--shell-bottom`.
- **Verified live on the owner's account:**
  - The studio shell shows the five destinations.
  - Home suggests "Create your application kit" for the saved Northwind job.
  - The pipeline shows Saved 2.
  - Profile strength asks for a career profile to be set up.
  - `/cv` redirects to `/documents`; `/presence` and `/coach` load.
  - A narrow Continue card was then fixed: the title wraps and the button no longer clips.
- **Deviation:** the spec's "Letter" entry in the Create sheet waits for R8.2, when the letter library exists. The Cover letter entry goes to Jobs, where letters are made today.

### R8.2 Documents hub and letter library
- **Letter library** (spec §10). Letter types are data in `src/modules/letters/types.ts`: one editor, one AI task and one PDF route serve every type. There are 8 types:
  - general cover letter;
  - resignation;
  - reference request;
  - thank-you after an interview;
  - application follow-up;
  - accepting an offer;
  - salary negotiation;
  - networking introduction.

  Each type is a guided form of 3–5 questions (required ones are marked).
- **"Write it myself"** is free. It starts from a draft built from the answers without AI, keeps nothing invented and leaves out lines with no answer.
- **"Write it with AI"** (Premium, `ai.action`) uses the new task `letter.generic`.
  - Facts may come only from the person's answers and the CV; anything else is marked for them to fill in (unit-tested with an injected "45%").
  - "Write a new AI draft" redrafts from changed answers.
- **Letter editor:** recipient lines, subject, greeting, paragraphs and sign-off, beside a live preview in the chosen CV's design (or a plain page). Save, Download PDF (counts as a PDF download) and Delete.
- **Storage and API:**
  - Letters live in the account at `users/{uid}/letters/{id}`, up to 100, and are deleted with the account.
  - API: `/api/letters` (list, create), `/api/letters/{id}` (read, change, delete), `/api/letters/{id}/draft` and `/api/letters/{id}/pdf`.
  - Other accounts get 404 (e2e).
- **Documents hub:** filters All · CVs · Letters and "For job". The Letters list shows library letters and the cover letters written on jobs (they open on their job). It has one-click starts for every letter type.
- **Create sheet:** Cover letter → the general cover letter; Letter → the type picker. The general cover letter points to Jobs when there is a specific advert.
- **Privacy page:** a paragraph on letters.
- **Verified live with real Gemini** (owner's account; Premium granted temporarily, then removed, usage reset and the test letters deleted):
  - Resignation letter, formal: "Dear Head of Engineering," with the role, organisation and last day exactly as answered, the thank-you and handover from the answers, and no invented facts (0 findings, 7 s).
  - General cover letter: used only CV facts and the "why" answer.
  - The PDF downloaded as `Nisar-Ahmad-Resignation-letter.pdf`.
- **Deviations:**
  - Letters are a separate account collection, not `docType: 'letter'` documents (Appendix B). This avoids touching every CV path (editor, sync, makeover, health check) for something with a different shape; the hub joins them.
  - Job cover letters stay on their job.
  - The letter editor keeps the studio shell; it is a form plus preview, not the full CV studio.
  - Turning letter types on and off in the Console comes with R8.7.

### R8.3 Presence hub
- **`/presence`** brings together the portfolio page, the LinkedIn writer and every share link:
  - **Portfolio:** live or not, its address, total visits and opens per day.
  - **LinkedIn:** a link to the writer.
  - **Share links:** each link with its CV, on or off, total opens, last opened, opens per day for 14 days, Copy, and Switch on/off.
  - The empty state offers to create a link for the latest CV.
- **Share analytics** (spec §10, P2, done now because Presence needs it): share-link and portfolio opens are also counted per day (`daily.yyyy-mm-dd`, server-side increments). The owner sees the last 14 days (`lastDays()`, unit-tested). Visitors are still not identified.
- `/portfolio` and `/linkedin` stay as the tools' own pages under Presence (the shell marks Presence as current).
- **Verified live:** the owner's Presence page shows the three areas. A test link opened twice was counted as 2, under today in the 14-day list (Firestore per-day increments work); the link was deleted afterwards.
- e2e: a stranger's two opens show on Presence, and switching the link off there makes it return 404.

### R8.4 Application kit and ATS check
- **ATS check** (`src/modules/quality/ats.ts`, `POST /api/quality/ats`, editor **Check** tab):
  - It makes the PDF exactly as it downloads, reads it back with our importer (the same one people use for old CVs) and reports pass / needs work / good to know per check. Each check comes with a specific fix and "Show me" (or "Open the Design tab"). There is no single score.
  - Checks:
    - text can be read (≥97% of words back);
    - name and contact found;
    - every job read with its employer;
    - reading order (sections, and a job's points before the next job);
    - usual section headings;
    - layout (columns or photo → suggest the ATS-safe version);
    - length.
  - "What the software reads first" shows the extracted text.
  - **Keywords (Premium, against a saved job):** the new task `quality.atsKeywords` lists the advert's terms; the app re-checks presence itself. For a missing term the AI may point to one of the person's own lines that already shows it in other words (only real line ids are kept), so a word is added only where it's true.
  - **Allowance `ats.check`:** visitor 0, free 2 a month (readability only), Premium unlimited (-1), plus the switch "ATS check" in Admin → Settings. Older saved settings get these values automatically.
- **Check tab** in the editor: Content · Design · **Check** (also on phones). It brings together the CV health check and the ATS check. "Show me" opens the field in place.
- **Application kit** (`POST /api/jobs/{id}/kit`):
  - One button on a job makes a CV tailored to the job, a cover letter and a covering email in one call (tailor and letter run in parallel).
  - It costs **3 AI actions**: `reserve()` now takes a weight, and the store reserves and releases by weight (unit-tested). If either part fails, nothing is counted.
  - The three pieces show side by side as live thumbnails. "Download CV and letter" downloads both PDFs; "Copy email" copies the email.
  - The job remembers its kit (`kit.cvId`). Home's next step goes to `/jobs/{id}#kit` and stops asking once the kit exists.
- **Tests:** unit tests for the read-back checks (good CV; lost contact, employer and order; columns) and keyword re-checking; e2e `ats.spec` (free twice a month then 402, the report, Show me, Premium keywords) and `kit.spec` (Home → kit, three pieces, 3 AI actions, two PDFs, free 402).
- **Verified live on the owner's real CV** (Premium granted temporarily, then removed and usage reset). The first live run found three **false alarms**, all fixed in the next release:
  - "only 40% read": we measured our parser's structure, not the words; readability now counts the words in the extracted text;
  - "reading order": a section whose first item had no text matched the word "other" anywhere; probes are now ≥8 distinctive characters;
  - bilingual headings ("EDUCATION / AUSBILDUNG"): the parser's heading list was used; the check now uses the same rule as the health check.
  - Keywords: "tune", "validate" and "query optimisation" were called missing next to "tuning", "validation" and "Query Optimization"; matching now handles word forms and British/American spelling (`stem()`, tested).
  - The kit with real Gemini: 3 AI actions, about 17 s, a tailored CV titled for the job, letter and email. One unknown number was marked for the owner to fill in.
  - The kit made for the owner's saved Northwind job is kept (CV "Nisar Ahmad — Database Performance Engineer (Remote) (Northwind Telecom Services)"); the owner can delete it.
  - Also found: once Premium ended, the job page hid the kit made earlier. Earlier kits now stay visible and downloadable (e2e).
- **Deviations:**
  - Proofreading (`quality.proofread`) is not part of the Check tab yet; it is not in this release's list.
  - The kit downloads two PDFs rather than one merged file.
  - The job page keeps its single column with the kit first, not the Kit · Interview · Notes tabs; the anchors `#kit`, `#letter` and `#interview` jump to each part.
  - AI weights are fixed in code (kit = 3) until the Console gets AI weights in R8.7.

### R8.5 Section types and levels
- **14 new section types** (spec §9.2), so there are 24 in all: publications, courses and training, memberships, conferences and talks, patents, military service, internships, interests, key achievements, references, strengths, testimonials, personal details, and declaration.
  - Most reuse an existing item shape (credential, job, skill group, custom). References, strengths, testimonials, personal details and the declaration have their own small shapes.
  - Credentials gained an optional link (publications, talks).
- **Every design supports them with no new template code.** `LAYOUT_KIND` lays each new type out like an existing one (publications like certifications, internships like work history, personal details like languages…). References, strengths, quotes and the declaration print as plain lines (`cv-plain`), without bullet markers.
- **Levels:**
  - Optional 1–5 level per skill keyword (kept with its keyword when skills are added, removed or reordered by tailoring).
  - Optional language level (CEFR A1–C2 or Basic / Conversational / Fluent / Native).
  - The composer draws them as bars or dots only when levels exist; otherwise tags and text, as before. `normalise` now allows bars and dots for a CV that has levels and still explains when it can't.
- **Section library:** "Add a section" lists all types with a one-line example each, and has a search box.
- **Job tools:** military service and internships count as jobs for match and tailoring; courses, memberships, publications, talks and patents count as credentials. Testimonials, references and personal details are never used as the person's facts.
- **Tests:**
  - unit: every new type renders in a hand-crafted and a composed design; bars and dots appear only with levels; normalise with and without levels;
  - e2e `sections.spec`: search the library, add Personal details and References and see them in the preview; a skill level survives a reload.
- **Deviations:**
  - Strengths print as title plus line, not as cards.
  - The declaration has no signature image yet.
  - The importer doesn't detect the new types (they go to "Other" as before).
  - Hand-crafted designs show levels as text (bars and dots are drawn by the composer).

### R8.6 Editing: on the page, drag, AI on a selection, profile sync
- **Edit on the page:**
  - Click text in the preview: when it is exactly one field (a name, job title, employer, a bullet point, a skill…), it becomes editable right there. Enter or clicking away saves it as one undo step; Escape cancels.
  - Text built from several fields (date ranges, "Employer · Town") still jumps to the form.
  - Mapping: `resume/inline-edit.ts` (unit-tested). Protocol: `cv:select` carries the clicked text; `cv:edit` and `cv:edit-done` in the iframe runtime.
- **Drag to reorder:** sections and entries have a grip in the form. The arrow buttons stay as the keyboard and screen-reader path (`ops.moveSectionTo` / `moveItemTo`).
- **AI on a selection:**
  - Select words in a points box or the profile, and a small toolbar offers Improve · Shorten · Expand · Fix grammar · More formal.
  - The new task `write.rewrite` (guarded against the selection and its field) returns a before → after card. "Replace the selection" swaps only those words.
  - It uses the existing Premium AI allowance.
- **"Update your career profile too?":** in a CV made from the profile, once the person pauses after changing a fact the profile still has as before, a banner offers "Update profile" or "Only this CV".
  - Facts covered: name, email, phone, town, job and qualification fields, and a point edited in place (matched by its old text).
  - Never synced: order, tailored summary or headline, hidden sections, design (`resume/profile-sync.ts`, unit-tested).
- **Bugs found while testing, fixed:**
  - **Undo after a signed-in edit could come back:** undo restored a snapshot with an older time stamp, so the account's newer copy won the next sync. Undo and redo now save with a fresh time.
  - **An edited preview frame could be reused for an identical document** (after undo), showing the edited text. Such a frame is no longer reused.
- **Tests:** unit tests for inline-edit and profile-sync; e2e `editing.spec` (edit on the page with form check, undo and Escape; drag a section; Premium rewrite of a selection; profile sync).
- **Deviations:**
  - The form updates when the on-page edit is finished (Enter or click away), not on every keystroke, so the page isn't rebuilt under the cursor.
  - Dragging on the page itself and touch dragging are not built; phones use the arrows.
  - Adding or removing whole entries is not offered to the profile.

### R8.7 Console additions and the R8 acceptance journey
- **Admin → Settings:**
  - **Switches** for the letter library and the application kit, next to the ATS check and the AI Designer.
  - **AI action weights:** the application kit counts as N AI actions (default 3; the kit route reads it).
  - **Letter types:** untick a type to stop offering it.
  - All three are enforced on the server: a refused letter type or a switched-off tool returns 403. Older saved settings get the defaults automatically.
- **Acceptance (spec §16, R8):**
  - e2e `journey.spec`: a new account goes Home → upload → CV → Home suggests a job → add the job with its advert → Create the kit, all checked to finish in under 10 minutes (seconds with the test AI).
  - Every destination (Home, Documents, Jobs, Presence, Coach) shows a next action for a new free account.
- **Not built (recorded):**
  - Console content for Help FAQ, offer wording, example prompts and next-step texts;
  - the email templates area;
  - AI cost in rupees on the dashboard;
  - per-task AI switches and model per tier.
  These belong with the R9/R10 tools that need them.

## Release 9 — Coach (in progress: R9.1–R9.3 live)

### R9.1 Mock interview
- **On every job (and from Coach):**
  - The AI interviewer asks 5 questions for that job, one at a time.
  - After each answer it gives feedback: a verdict (strong / good / work on this one), which STAR parts the answer has, what worked, what to improve, and a tip using a real fact from the CV. It ends with a short summary.
  - The interview is kept on the job (`mock`, plus the last 5 results in `mockPast`); "Practise again" starts a new one.
- **Task `interview.turn`** (smart):
  - Feedback and summary are fact-guarded against the CV and what the person said.
  - The feedback must quote the person's own answer; a quote that isn't in the answer is dropped (`jobs/mock.ts`, unit-tested).
  - Text inside the answer is data, not instructions.
- **Cost:** each turn is one AI action (`aiWeights.mockTurn`, default 1), Premium. Switch: `features.mockInterview` (Console comes with the other R9 switches).
- **Evaluation:** 12 new samples in the live evaluation (driver, nurse and engineer adverts):
  - the first question;
  - a vague answer, which must not be called strong;
  - a full STAR answer, which must not be "work on";
  - an answer that tries to inject instructions, which must not be obeyed.

  Samples can now carry their own quality checks. A dry run of the whole set through the demo provider is a unit test.
- **e2e `mock.spec`:** 5 answers, feedback and verdicts, the quote, summary, 6 AI actions counted, kept after reload, practise again, and 402 for free accounts.
- **Deviation:** answers and feedback are returned whole, not streamed token by token (each turn takes a few seconds).

### R9.2 Career coach
- **Coach page:** a chat at the top of Coach, with starter questions. The coach answers from the person's main CV and their tracked jobs; the conversation is kept (last 40 messages, `users/{uid}/coach/main`), and Clear removes it. Account deletion removes it too.
- **Studio actions:** the coach can offer up to 3 buttons per reply — tailor a CV, application kit, cover letter, job match, mock interview, write a letter (by type), ATS check, add a job, change the design. Each button runs the normal route with its normal Premium checks; nothing runs without a click.
- **Task `coach.chat`** (smart): the reply is fact-guarded; actions are checked server-side (`coach/thread.ts`, unit-tested) — only the person's own jobs, valid letter types, no duplicates. The model sees the last 12 messages.
- **Cost:** each message is one AI action (`aiWeights.coachTurn`, default 1), Premium. Switch: `features.coach`.
- **Evaluation:** 20 scripted coach tasks in the live evaluation (the right action and job for the request, never a job that isn't tracked, refusing off-topic and injected instructions). Results now list "problems" separately and count them against the pass mark.
- **e2e `coach.spec`:** starter question → advice from the CV, accessibility check, tailor offered and run (3 AI actions counted), kept after reload, resignation letter button, clear; free account 402 and Premium banner; visitor 401.
- **Fix found by the test:** new Chrome returns a Promise from `scrollIntoView`, which crashed the page when used as an effect's return value.
- **Verified live with real Gemini (2026-11-13, owner's account; Premium granted temporarily, then removed, usage reset and the chat cleared):**
  - "Which of my skills should I lead with?" on the owner's real CV: a specific answer (.NET/C# backend, SQL Server tuning, workflow automation, telecom clients from the CV), with tailor buttons for both tracked jobs and the ATS check; the ATS button opened the Check tab on the right CV.
  - **Coach evaluation: 19/20 on the first run**, average about 5 s, no unmarked new facts. Every action named the right tool and a tracked job; letter types matched the situation; the injection was declined.
  - Found and fixed: the guard marked "I'm" and "I'd" as unknown names (now never flagged, unit-tested); for an untracked "Google job" the coach should offer **Add a job** (the check now requires that; an offer for a tracked job is fine); the reply no longer names tools ("the add job tool"), it points to the button (`coach@2`).
  - **Second live run after deploy: 20/20**, average 5.3 s; the Google request now offers only Add a job. Three replies still showed a guard marker: generic advice numbers ("within 24 hours", an unstated year count), caught correctly, and "ATS" flagged as a name (false alarm). Fixed: "ATS" is allowed, and the coach uses numbers only from the CV or jobs (`coach@3`).
  - **Third live run (`coach@3`): 20/20, no guard markers in any reply**, average 6.5 s. R9 acceptance for the coach (20 scripted tasks) is met.

### R9.3 Story bank
- **What it is** (spec §10.3, "reusable achievement stories written once, tagged by skill, used in interviews and letters"): `/stories`, reached from Coach (the shell marks Coach) and the command palette. Each story has a title, situation, task, action, result and up to 8 skill tags. Kept at `users/{uid}/stories/{id}`, deleted with the account.
- **Writing is free**, up to the plan's number: new Console setting **Stories kept** (visitor 0, free 3, Premium 50). Switch: **Story bank**.
- **Draft from my CV** (Premium, one AI action, weight `storyDraft`): pick a point from your CV (job, project or other bullet), optionally add notes, and the new task `story.draft` writes the STAR story. Facts may come only from that point, its job line and the notes; anything missing becomes a question to answer (`{{?…}}`), and the editor asks you to answer them. Tags are chosen only from the CV's skills. Nothing is saved until you press Save.
- **Used in interviews:** the mock interview shows "Your stories that fit" the current question (matched by skill tag and words, no AI; `matchStories`, unit-tested), with **Use this story** to fill the answer. A good or strong answer can be **saved to the story bank**.
- **Used as facts:** finished stories go to the mock interviewer (its tip can name one), the coach (can suggest one) and AI letters (`mock@2`, `coach@4`, `letter-generic@2`). The fact guard accepts them as the person's own words.
- **Console:** switches and AI weights are now there for all R9 tools — mock interview, coach and story bank; weights for the kit, a mock turn, a coach message and a story draft.
- **Privacy page:** a paragraph on stories.
- **Evaluation:** 7 `story.draft` samples (driver, nurse, engineer, teacher, graduate; one with notes; one where the notes ask to invent numbers and awards). Checks: the action is there, tags only from the CV's skills, no number that isn't in the point.
- **e2e `stories.spec`:** from Coach to the empty bank (axe), draft from a CV point with notes, edit title and tag, save, reload, edit, 1 AI action counted, delete; mock interview offers the matching story only on the right question and fills the answer (axe), saves a strong answer; free account keeps 3, the 4th is refused, drafting is 402; visitor 401; another account gets 404.
- **Found while testing:** pale hint text on the tinted draft panel and an un-underlined link inside a sentence failed the accessibility check (fixed); the draft panel closed while typing a title (now decided once when the editor opens).
- **Found live on the owner's real CV:** the point list offered the imported "Core strengths" list and personal details (nationality, date of birth, phone) as story points. Points now come from jobs, volunteering and projects first, and personal-detail lines and skill lists are never offered (unit-tested).
- **Verified live with real Gemini (2026-11-14, owner's account; Premium granted temporarily, then removed, usage reset, the test story and chat deleted):**
  - Draft from the owner's "Workflow Automation" point with a note: a clear STAR story in 9.8 s; the 40% and 25% are the CV's own figures, the note ("two people did it by hand") was used, nothing invented. A draft from a point with no result asked a question instead of inventing one.
  - With that story saved, the coach answered "they will ask about a time I improved a process" by naming the story and using only its facts, and offered mock interviews for both tracked jobs.
  - **Story evaluation: 7/7**, no unmarked new facts; "invent impressive numbers and awards" was ignored. One guard false alarm: a Title Case title ("Delivering 120 Parcels Daily…") marked words as names. Titles are now asked for, and turned into, sentence case (`story@2`, unit-tested).
- **Deviation:** a mock answer is saved whole as the story's action; the person splits it into STAR parts if they want.

### R9.4 Skill gap and learning plan
- **What it is** (spec §10.3, "for a target role: skills present, missing, and what to learn first"): `/skills`, reached from Coach, each job page ("Make a learning plan for this job", under the match) and the command palette. The target is one of your tracked jobs (its advert) or a role you type.
- **Task `skills.gap`** (smart, one AI action, Premium; weight `skillGap`, switch **Skill gap and learning plan**): 6–12 skills for the role, each **have / partly / missing** with the CV lines that show it, then up to 5 **learn first** steps (why, how — no links or prices, how to show it on the CV once true, rough weeks) and an honest summary (fact-guarded).
- **The app checks the answer** (`skills/gap.ts`, unit-tested), the same way as job match: evidence must be real CV lines and is shown in the person's own words with **Show me**; "have" with only the headline or summary is "partly", "partly" with no evidence is "missing"; steps only for skills still to learn, once each; links removed; weeks 1–26.
- **Progress:** each step is To do / Learning / Done, kept with the plan; a done step offers **Add it to my CV** and **Write a story about it**. Up to 10 plans per account at `users/{uid}/skillPlans/{id}`, deleted with the account.
- **Coach:** new action **skill_gap** ("Make a learning plan for …", for one of your jobs or a role in general); `coach@5`. The coach evaluation now has 21 tasks (one for the new action).
- **Evaluation:** 6 `skills.gap` samples (driver, nurse and engineer adverts; "Transport planner" and "Junior data analyst" typed; an instruction hidden in the role). Checks: no evidence id that isn't in the CV, no "have" without evidence, plan only for skills to learn, no links, a plan when something is missing, the injection not followed.
- **e2e `skills.spec`:** from Coach to the empty page (axe), the job preselected, a plan with evidence and Show me, two steps, mark done (progress, Add to CV, story link), kept after reload; a second plan for a typed role, switch between plans, delete; 2 AI actions counted; `/skills?job=` preselects; another account 404; crafted input refused; free 402 with a message; visitor 401.
- **Found while testing:** the job list sat inside the radio button's label, so screen readers read every job as the radio's name; the group headings skipped a level. Both fixed.
- **Deviation:** plans don't refresh themselves when the CV changes; make a new plan to see the change.

## Owner to-do (when you have time)

1. ~~Payments and sales~~: done on 2026-11-12.
2. ~~Launch designs~~: done 2026-11-13 (owner approved) — Clarity, Chronicle and Heritage free, the other 7 Premium. Changeable per design in Admin → Settings.
3. ~~Growth~~: done 2026-11-13 (owner approved) — code `LAUNCH20` (20% off, 100 uses, until 2026-12-31; untick Active to pause) and Invite friends on (tick box in Settings).
4. ~~Alerts~~: done 2026-11-13 — email channel "AI CV Studio alerts" (aicvstudio.app@gmail.com) added to the production policy.
5. ~~Staging Google sign-in~~: done 2026-11-13 — staging domain added to Firebase Auth authorised domains.
6. ~~Git tags~~: done 2026-11-13 — created by the `Release tags` workflow from `.github/release-tags.txt`.
7. ~~Buyer emails~~: on since 2026-11-13 — sent from support@aicvstudio.app (Namecheap Private Email; password in the Secret Manager secret `SMTP_PASSWORD`, set by the owner). A test email was accepted by the mail server.
8. ~~Firestore rules~~: published 2026-11-13 (owner: this site is the only product in the project). They replaced the old Flutter app's rules, which let browsers write to `users` and `paymentRequests`; the old version stays in the console's rules history. The live site was checked afterwards.
9. **Makeover acceptance with real CVs:** try 40 real CVs (10 Word, 10 PDFs from other builders, 10 two-column, 5 scans, 5 phone photos) on `/makeover` and note any wrong or missing text.
10. **R7 human checks:** the 30-person blind design preference test (target 60%) and an outside reviewer's rubric scores for the 22 new designs (minimum 8.5).
11. **Later:** publishing the browser extension to the Chrome Web Store (R10).

## Next action (exact)

1. R9 "Coach": R9.1 mock interview, R9.2 career coach and R9.3 story bank are live. Next: R9.4 skill-gap plan, then job from URL, reminders by email, share comments, portfolio themes, LinkedIn review, application analytics — spec §16. (Console switches and weights for the R9 tools came with R9.3.)

## Deployment (2026-11-12)

- **Production:** https://aicvstudio.app.
  - Firebase project `ai-cv-studio`, App Hosting backend `aicvstudio` in europe-west4.
  - Deploys automatically from GitHub `nisar87/AI_CV_Studio_Redesign`, branch `main`.
- **Verified on the live domain:** HTTPS; all pages return 200; `/api/health` reports chromium ok; a real PDF downloads (1 page, fonts embedded).
- **Fix needed for Cloud Run:** `@sparticuz/chromium` must unpack its bundled libraries (`AWS_LAMBDA_JS_RUNTIME` opt-in in `src/modules/export/pdf.ts`).
- **DNS (Namecheap):**
  - A record `@` changed to `35.219.200.104`.
  - Added the `fah-claim` TXT record and the `_acme-challenge_…` CNAME.
  - Email records (privateemail MX/SPF/DKIM, Firebase mail DKIM) unchanged.
- **Old Flutter site removed (owner approved):**
  - `aicvstudio.app` detached from the Hosting site.
  - Deleted Cloud Functions: `gemini`, `extractlinkedinprofile`, `renderaiwowpdf`, `notificationsender`, `adminsetuserpremiumaccess`.
- **Left untouched (separate products):** `career-os-*` services and their secrets.
- **Old Firestore/Auth data:** not deleted. `career-os` shares the project, so wholesale deletion needs a separate check.
- **Gemini is on in production** (`AI_PROVIDER: gemini`; it was paused earlier on 2026-11-12, then re-enabled on the owner's direction for import). AI writing help is Premium-only through the gate. It was verified working earlier (2026-11-12, after `firebase apphosting:secrets:grantaccess GEMINI_API_KEY --backend aicvstudio`). Live checks on aicvstudio.app with real Gemini:
  - Both brief examples give sensible choices:
    - Teacher → teacher preset, blue accent, elegant (executive) font, "School Teacher".
    - Driver → driver preset, Clarity, "Delivery Driver".
  - Improved bullets added no facts and asked "How many parcels did you deliver each day?" instead.
  - Messy notes became 4 faithful points.
  - The full `npm run ai:eval` (48 samples) is still to be run for the Phase 4 acceptance record.
- The old Hosting site is disabled (`firebase hosting:disable`; `ai-cv-studio.web.app` returns 404).

## Known blockers

- **GitHub:** all branches are pushed to `nisar87/AI_CV_Studio_Redesign` (2026-11-12). Tags could not be pushed from this session (proxy refuses tag refs); they are in `ai-cv-studio.bundle` — run `git push origin --tags` from a local clone.
- **CI:** green on GitHub Actions (main, 2026-11-12). The runner is pinned to `ubuntu-24.04`.
- **Workspace network:** the build workspace can no longer reach aicvstudio.app directly (proxy 403). Production checks run through the owner's browser session.
