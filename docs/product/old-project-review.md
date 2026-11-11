# Review of the Previous Project (Flutter, reference only)

Source: `github.com/nisar87/AI_CV_Studio` (inspected November 2026). Nothing from it is reused — not code, components, architecture or UI. This file records what to learn.

## What it was

- Flutter app (web + mobile + desktop targets) with Firebase (Auth, Firestore, Functions) and Google Gemini through a server proxy.
- ~3,400 files; more than 150 markdown planning/QA documents, including a 285 KB `PROJECT_CONTEXT.md` and a 180 KB `ROADMAP.md`.
- Shipped capabilities (per its own README): PDF upload and text extraction, "Quick Create" from pasted career text, AI score with strengths/problems, "Fix My CV" with rescore, job-match analysis with branched job-specific versions, local saved CVs, a 26-template gallery, a "Design Studio", custom AI template generation, PDF export, optional accounts, manual payments and an admin area.

## The business concept worth keeping

| Idea | Keep? | How it lives on |
|---|---|---|
| Describe the CV you want in plain words and get it | **Yes — core** | AI interprets intent into a validated design spec (see `../engineering/template-engine.md`) |
| "~10% user work, ~90% studio work" | **Yes** | Guided flow + smart defaults + AI drafting |
| Truth-first AI: rewrite and emphasise, never invent | **Yes — core** | Hard rule in AI architecture with confirmation UI |
| Master CV protected; job-specific versions branch from it | **Yes** | Document versions with a parent link (Phase 4+) |
| Explainable CV score | Partly | Replace a single 0–100 number with a short, specific checklist; numbers invited false confidence |
| One career workspace growing into letters, portfolio, website | **Yes** | Long-term vision, phased |
| Local-first privacy, optional account | **Yes** | MVP works without sign-up; account adds sync |

## What failed, and why

1. **Three rendering paths.** The editor canvas, the preview and the PDF were built separately (Flutter widgets vs. a PDF layout library). Its own architecture decision record states that parity fixes "never stayed fixed": fixing skill bars in PDF overflowed pages; fixing overflow degraded the design.
   → **Lesson:** one render source for preview and export. We render HTML/CSS once and print that exact document with Chromium.
2. **AI generating layouts.** Letting the model produce or heavily steer low-level layout made output unstable, hard to validate, and — despite different prompts — visually similar.
   → **Lesson:** AI picks and configures from a small set of professional, deterministic primitives. It never emits layout code.
3. **Quantity over quality in templates.** 26 templates went through repeated "batch QA", "Magnific redesign" and "owner visual QA" sprints, yet internal scores (~96/100) diverged from the owner's own judgement (~5.5–6/10).
   → **Lesson:** ship three to five templates that are excellent on real, varied content; judge visually against real PDFs, not heuristic scores.
4. **Process overload.** Documentation grew to hundreds of files, many of them sprint ledgers; a "frozen constitution", authority orders and stub files existed to stop agents contradicting each other.
   → **Lesson:** a small, focused `/docs` set kept consistent; a single `STATUS.md` checkpoint; ADRs for decisions.
5. **Premature platform work.** Admin claims, payment review, entitlement architecture and notification queues were built before the core CV was excellent.
   → **Lesson:** monetization, admin and teams come after the core loop is loved.
6. **Upload-first assumptions.** Image-based PDF CVs failed extraction with no fallback, ending the journey.
   → **Lesson:** every import path must degrade gracefully to "paste text" or "answer a few questions".

## Implications for the new product

- The template engine is the most important engineering investment (see `../engineering/template-engine.md`).
- The AI layer is a set of narrow, schema-validated tasks rather than one "do everything" prompt (see `../engineering/ai-architecture.md`).
- The first release is a calm, excellent CV builder that already feels AI-native; breadth comes later.


## Correction (2026-11-12)

This review filed the old app's accounts, Premium limits, manual payments and admin review under "premature platform work". That was wrong: they are the business model of a paid product. The *way* they were built was the problem (screen-by-screen checks, counters on the device, rules never deployed, side systems before paying users), not their existence. See `business-model-plan.md` for how the new product handles them.
