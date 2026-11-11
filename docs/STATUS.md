# Project Status (checkpoint)

_Last updated: 2026-11-12 (live on Firebase App Hosting at aicvstudio.app)_

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
| 4 AI assistance (Gemini) | `phase-4/ai-assist` | 🟡 Built and verified with the mock provider, merged to `main`. Live acceptance (criteria 3–4 with real Gemini) waits for the owner's `npm run ai:eval` run |

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

**Still open (valid, not yet done):** PDF tagging is Chrome's default ("NonStruct"); accessible tagging needs a dedicated pass (Phase 11). Real-photo cropping has only been tested with illustrations.

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

## Next action (exact)

1. **Owner:** answer the decisions in `product/business-model-plan.md` §8 (prices, free allowances, payment accounts, old users, old data).
2. Then start **Phase 4b — Accounts and plans** on branch `phase-4b/accounts-plans`, per the plan's §4 and §6.
3. Run the live AI evaluation (`npm run ai:eval`) during 4b, before AI is switched back on for Premium users.

AI help is **paused in production** (owner decision, 2026-11-12) and the "free / no sign-up" claims are removed, until 4b lands.

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
- **AI help is ON in production** (2026-11-12, after `firebase apphosting:secrets:grantaccess GEMINI_API_KEY --backend aicvstudio`). Live checks on aicvstudio.app with real Gemini:
  - Both brief examples give sensible choices:
    - Teacher → teacher preset, blue accent, elegant (executive) font, "School Teacher".
    - Driver → driver preset, Clarity, "Delivery Driver".
  - Improved bullets added no facts and asked "How many parcels did you deliver each day?" instead.
  - Messy notes became 4 faithful points.
  - The full `npm run ai:eval` (48 samples) is still to be run for the Phase 4 acceptance record.
- The old Hosting site is disabled (`firebase hosting:disable`; `ai-cv-studio.web.app` returns 404).

## Known blockers

- **GitHub:** all branches are pushed to `nisar87/AI_CV_Studio_Redesign` (2026-11-12). Tags could not be pushed from this session (proxy refuses tag refs); they are in `ai-cv-studio.bundle` — run `git push origin --tags` from a local clone.
- **CI not yet run on GitHub:** `.github/workflows/ci.yml` is written and every step was run locally, but it has never executed on GitHub Actions.
