# AI CV Studio — Studio Master Plan

_Status: **approved by the owner 2026-11-12** · Replaces `business-model-plan.md`_

## 0. In one page

**What we are building.**
- A paid **career studio**: one career profile that the person owns, from which the studio produces everything a job search needs:
  - CVs, in several versions,
  - cover letters,
  - application emails,
  - a LinkedIn profile,
  - a personal portfolio page,
  - job-specific tailoring, with progress tracked.
- All of it shares one design system and one honest AI.
- It is **not** another CV builder with a payment screen.

**How it is controlled.**
- An **Admin Console** runs the business without code changes:
  - which designs and features are free or Premium,
  - plans, prices, limits and payment methods,
  - feature switches,
  - AI models and budget,
  - users, payments and site announcements.
- Every change is validated, logged and reversible.

**Why it will not fail like the first attempt.**
- Three foundations are built once and correctly before any feature rides on them.
- Every release is **live with real users** before the next one starts.
- Each release has a fixed scope, a "done when" test and success numbers.
- Nothing is "partially wired".

## 1. Why the first application went nowhere (diagnosis)

The old repository is valuable as reference. Its own documents explain the outcome:

| Symptom (from the old repo) | Root cause | What we do instead |
|---|---|---|
| 26 templates, AI template generator, Design Studio, LinkedIn scraper, Career OS, notification queue, admin panel, all partly finished | **Breadth before depth.** No feature reached "finished and used by real users" before the next began | Release train: each release ships live and is used before the next starts (§6) |
| Limits enforced screen by screen across ~15 "waves" (Wave 1-D … 1-P), each closing another bypass | **No single enforcement point**; rules lived in the UI | One server-side entitlement gate; the UI only reflects it (§4.3) |
| Usage counters on the device; Firestore rules written but "do not deploy" | **Security as paperwork**, not as running code | Rules deployed with automated tests in CI; counters only on the server |
| Admin settings could be edited, but defaults, local drafts and remote copies diverged | **Config without a schema or single source** | Typed, validated, versioned config with one resolver (§4.4) |
| Template data mismatches fixed one by one (UX23S-2…11) | **No single document model** shared by every template | One model and one render path, already done in the redesign (Phases 2–3) |
| Hundreds of audit/QA documents, "Must Revise Again", owner QA blocked | **Quality checked at the end by the owner** instead of built in | Automated quality gates (template parity tests, e2e, AI evaluation); the owner reviews outcomes |
| Pilot "ready" but prices, receivers and payment methods still placeholders | **Business decisions deferred until after the build** | Owner decisions are inputs to each release (§9) |

## 2. Product: what "the studio" is

```
                        ┌───────────────────────────────┐
                        │  CAREER PROFILE  (the truth)    │  confirmed facts: work, education,
                        │  owned by the user, in cloud    │  skills, licences, achievements…
                        └───────────────┬────────────────┘
        ┌───────────────┬───────────────┼───────────────┬────────────────┬──────────────┐
        ▼               ▼               ▼               ▼                ▼              ▼
   CV versions     Cover letters   Application     LinkedIn         Portfolio      Job tracker
   (master +        (per job)       emails          profile text     web page       (jobs, stage,
    tailored)                                                        (public URL)    documents used)
        └───────────────┴──── one Design System (10+ designs, fonts, colours) ─────────┘
                        └──── one honest AI (truth guard, cost-capped, gated) ─────────┘
```

**Rules of the product:**

- **Facts live once.** They live in the profile. Documents choose and phrase those facts; they never fork them silently. If a fact is edited in a document, the user is asked: "Update your profile too?"
- **Every output uses the same template engine.** Design tokens are shared, so a letter matches its CV and the portfolio page matches both.
- **AI never invents.** This is our defensible difference, built and tested in Phase 4.
- **Start fast, deepen later.** A first CV still takes under 10 minutes, and the studio grows around it. The person who only wants one CV is never forced through "workspace" complexity.

**Who pays and why:**
- People in active job search: tailoring, letters, AI writing, premium designs.
- People who want a professional presence: portfolio, LinkedIn.
- Free users get a genuinely good basic CV. That is how they find us and recommend us.

## 3. Plans and what they unlock (starting values, all admin-editable)

| Capability | Visitor | Free account | Premium (pass) |
|---|---|---|---|
| Build, edit and preview CVs | ✅ (on this device) | ✅ (cloud, all devices) | ✅ |
| Career profile | — | ✅ | ✅ |
| Designs | Preview all | **Free set** (Clarity, Chronicle, Heritage) | All |
| PDF download | Sign in first | 3 / month | Fair use (100 / month) |
| Import PDF/Word CV | — | 2 / month | 30 / month |
| AI writing, describe-a-style, skills | — | Offer shown | ✅ 300 AI actions / month |
| Job tailoring + job tracker | — | Track up to 3 jobs | ✅ |
| Cover letters and emails | — | — | ✅ |
| LinkedIn profile writer | — | — | ✅ |
| Portfolio page | — | — | ✅ |
| Saved documents | Device only | 5 | 100 |

**Premium is a time-limited pass** (for example 1 month or 3 months), not an auto-renewing subscription:
- It suits manual payment (JazzCash, EasyPaisa, bank).
- It matches our "no subscription traps" promise.

A card gateway can add renewals later behind the same billing interface (§4.5).

## 4. Architecture: three foundations, then features

### 4.1 Foundation A — Identity and the Career Profile

- **Firebase Auth** in the existing project `ai-cv-studio`:
  - email + password (verification, reset) and Google sign-in,
  - old users keep their accounts.
- **Server sessions.** Next.js verifies the Firebase ID token with `firebase-admin` and sets a short-lived, httpOnly session cookie.
- **Firestore data, owned by the user:**
  - `users/{uid}` profile basics,
  - `users/{uid}/profile/main` (the Career Profile),
  - `users/{uid}/documents/{id}` (CVs, letters…, each with a `type`, `design` and `content`),
  - `users/{uid}/jobs/{id}`.
- **Local-first editing is kept.** Autosave writes locally, then syncs to the cloud. A visitor's CVs move into the account on sign-up. Conflicts use "last edit wins", with the previous version kept in history.
- **The existing document schema (Zod) stays the contract.** Each document type adds its own schema.

### 4.2 Foundation B — Document engine (already built, extended)

- One render path (HTML → paginated preview → identical PDF) serves **every document type**.
- Templates declare which document types they support. A "family" shares tokens, so the CV, letter and portfolio match.
- The template authoring guide and quality gates apply to every new template and type.

### 4.3 Foundation C — Entitlements, usage and billing (the single gate)

```
request ─► requireUser() ─► can(user, capability, context) ─► do work ─► record usage (atomic)
                                  │
                       plan (from active pass) + limits (from config) + usage (this month)
```

- **One module, `src/modules/billing/`, with three functions:**
  - `can()` decides,
  - `consume()` increments usage atomically after success,
  - `explain()` produces the user-facing reason and offer.
- **Server routes call it**, never screens: `/api/ai/*`, `/api/pdf`, `/api/import`, document create, portfolio publish. The UI asks `/api/me/entitlements` only to *show* badges and offers.
- **Capabilities are a fixed list in code**, for example `ai.write`, `design.use:<id>`, `pdf.download`, `import.cv`, `letters`, `portfolio.publish`. Which plan grants which capability, and how many times, is **data from the Admin Console**.
- **Data:**
  - Passes: `users/{uid}/entitlements/current`, compatible with the old app's records.
  - Usage: `users/{uid}/usage/{yyyy-mm}`, written only by the server.
- **Firestore security rules live in the repo and are deployed by CI**, with emulator tests. No user can write their own entitlement, usage, payment approval or config.

### 4.4 The Admin Console (`/admin`)

Visible only to accounts with the `admin` custom claim, checked on the server for every admin request. Every change is written to an append-only **audit log** (who, when, before → after).

| Area | What the owner can do |
|---|---|
| **Dashboard** | New users, active Premium, pending payments, downloads, imports, AI actions and **AI cost today/month**, errors |
| **Users** | Search by email; see plan, pass expiry and usage; grant, extend or revoke Premium; reset a usage counter; disable an account |
| **Payments** | Pending queue; approve (choose pass, sets expiry) or reject (reason shown to user); history; duplicate-reference warning |
| **Plans and pricing** | Edit plans, prices (PKR), pass durations, and which capabilities each plan has, with limits |
| **Designs (catalogue)** | For each design: enabled, Free or Premium, "New" badge, display order, recommended professions |
| **Features** | On/off switches: AI per task, import, letters, portfolio, maintenance mode, sign-ups open/closed |
| **Payment methods** | JazzCash, EasyPaisa and bank accounts with instructions; activation promise text |
| **AI** | Model per tier, daily budget, per-user monthly limits, kill switch |
| **Content** | Site announcement banner, Help FAQ entries, upgrade-offer wording |
| **Audit log** | Every admin change and payment decision, filterable |

**How settings work, which avoids the old divergence:**

- **One typed schema per settings area** (Zod), shared by the Console, the server and the tests. Invalid settings cannot be saved.
- **Stored in Firestore `config/{area}`** with a version number. Each save creates a new version, so **any previous version can be restored in one click**.
- **One resolver on the server** reads the config, falls back to code defaults only if a document is missing, and caches it for 60 seconds. Every page and API uses this resolver.
- **Public parts** (catalogue, plan names, prices, payment instructions) are served from one endpoint. Private parts (AI budget, limits) never leave the server.

### 4.5 Billing behind an interface

- **`PaymentProvider` interface.** The first implementation is `manual` (request, admin approval, pass). A card gateway (Stripe, Paddle, or a local PSP) can be added later as a second implementation **without changing the entitlement gate or the Console**.
- **Approvals and grants** each write the pass and an audit entry in a single transaction.

### 4.6 Operations

- **Hosting.** Firebase App Hosting (live now). There are two backends: `aicvstudio` serves production from `main`, and a **staging** backend serves the `develop` branch for owner review before release.
- **CI** (GitHub Actions): lint, types, unit, e2e, template parity, rules emulator tests, client-secret check. **`main` is protected; only green builds merge.**
- **Analytics.** Server-side events, with no CV content, feed the dashboard numbers and the success measures.
- **Error monitoring.** Structured logs (already in place) plus alerting on 5xx rates and AI budget at 80%.
- **Email** for the few that matter (verification, password reset, payment approved or rejected), sent by Firebase Auth and one small sender. There is no general queue.

## 5. What we take from the old app, and what we drop

| Take (as reference) | Drop |
|---|---|
| Firebase project, user accounts and the old Premium records | Flutter web front end |
| Manual payment flow (methods, reference, admin approve/reject, audit) | Client-side entitlement checks and device counters |
| Admin areas (users, payments, plans, templates, settings, security log) | Admin email allowlist (the server `admin` claim only) |
| Password/verification UX decisions | LinkedIn scraping via Apify (cost and terms risk). A **LinkedIn profile writer** that produces text the user pastes is offered instead |
| CV health check and job match ideas | Custom AI template *generation* (unsafe layouts). "Describe a style" picks from the catalogue instead |
| Its lessons (§1) | The notification queue framework and stub sections |

## 6. Release plan (each release goes live and is used before the next starts)

### Release 1 — "Paid CV Studio" (the foundation release)

Goal: real people sign up, make CVs, import old CVs, buy Premium, and you run it all from the Console.

| Milestone | Scope | Done when |
|---|---|---|
| **R1.1 Identity and cloud documents** | Sign-in (email, Google), account page, server sessions; Firestore documents with sync; device CVs move into the account; old accounts work | A visitor's CV appears after sign-up on another device; an old user signs in; rules tests pass in CI |
| **R1.2 Entitlement gate and config** | `billing` module; capabilities; usage counters; config resolver and schemas; `/api/me/entitlements`; downloads, designs and AI gated; Premium offer UI | A crafted request cannot bypass any limit (e2e); changing a design to Premium in config takes effect within 60 s |
| **R1.3 Admin Console v1** | Dashboard, Users, Payments, Plans, Designs, Features, Payment methods, AI, Audit log | Owner changes a price, a design tier and a limit, then restores the previous version, all without code |
| **R1.4 Get Premium (manual)** | Pass purchase page and request form; approval sets expiry; expiry ends access; emails for approved and rejected | Owner completes a real payment end to end on staging, then on production |
| **R1.5 Import** | PDF and Word upload; server text extraction; AI `import.structure` into the profile and a CV, with uncertain fields flagged; free allowance | 10 real CVs import with no invented facts; a free user imports and downloads in a free design |
| **R1.6 Launch gate** | AI live evaluation (≥30 samples, 0 invented facts); accessibility and performance pass; privacy and terms text; staging backend; alerts | All gates green; AI switched on for Premium; release announced |

**Success numbers (first 4 weeks after R1):**
- Visitor → account rate at the download step.
- Free → Premium conversion.
- Payment approval time.
- AI cost per Premium user, which must stay under ~20% of the pass price.
- Import success rate.

### Release 2 — "Job-ready"

- Career Profile editor as its own space, with CVs drawing from it.
- **Job tracker**: save a job advert, then track its stage and which documents were sent.
- **Job tailoring**: match and gap analysis with evidence from the profile, then a tailored CV version.
- **Cover letters and application emails** in matching designs.
- **CV health check**: explainable, specific, no fake scores.

### Release 3 — "Professional presence"

- **Portfolio page** at `aicvstudio.app/p/name`, published from the profile, with themes from the design system and simple visit counts.
- **LinkedIn profile writer**: headline, About section and experience text, ready to paste.
- **Share links** for CVs: read-only, can be switched off.
- DOCX export.

### Release 4 — "Growth and reach"

- Card payment gateway (once the business is registered).
- Coupons and referral rewards.
- More languages, starting with an Urdu interface and Urdu/English CVs if demand shows.
- Interview preparation from the profile and job.

Each later release is planned in detail only when the previous one is live, using its numbers.

## 7. How we work (so it does not drift)

1. **One release at a time.** A milestone is finished only when it is merged, deployed to production, its "done when" test is automated, and its numbers are visible on the dashboard.
2. **Staging first.** The owner reviews on staging and approves in one message; then it goes to production.
3. **Foundations are frozen interfaces.** Features use `requireUser`, `can/consume`, the config resolver and the document engine. They never work around them. Code review rejects bypasses.
4. **No placeholders in production.** Prices, accounts and texts are decided before the milestone that needs them (§9).
5. **Quality is automated.** Template gates, e2e journeys, rules tests and the AI evaluation run in CI. The owner judges the product, not regressions.
6. **Cut, don't stub.** If something cannot be finished in its milestone, it is removed from the UI rather than shown as "coming soon".

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI costs exceed revenue | Per-user monthly limits, global daily budget, cost on the dashboard, Flash-tier models, Premium-only AI except one cheap import call |
| Manual payment fraud or duplicates | Duplicate-reference check, the owner confirms funds before approving, audit log, pass expiry |
| Owner review becomes a bottleneck | Staging plus automated gates; the owner approves releases, not individual fixes |
| Old users confused by the new app | Same login; their Premium is honoured until expiry; a one-time "Welcome to the new AI CV Studio" message |
| Gemini terms (age 18+, paid tier for privacy) | Billing-enabled project (done); a 18+ statement at sign-up; privacy text matches reality |
| Scope creep returns | §7 rules; each release scope fixed at the start; new ideas go to the next release's list |

## 9. Owner decisions (resolved 2026-11-12)

- Plan approved, with a free hand to implement it the best way.
- **Fresh start.** The old app never had real users, so no old accounts, Premium records or saved CVs are carried over. The old app is not a flow reference.
- **Reference products** are the best current CV tools (Resume.io, Zety, Kickresume, Enhancv, Teal, Rezi). Flows may change wherever that gives a better modern product.
- Prices, limits and payment accounts start from the defaults below and are edited in the Admin Console.

### Original decision list (kept for reference)

1. **Approve this plan**, or say what to change.
2. **Prices and passes:** the proposal is PKR 499 for 1 month and PKR 1,299 for 3 months. These are editable later in the Console.
3. **Free account starting limits:** the proposal is §3. They are also editable later.
4. **Payment accounts** (JazzCash, EasyPaisa, bank) and the activation promise, for example "within 12 hours".
5. **Old Premium users:** honour until expiry (recommended).
6. **Old saved CVs in Firestore:** offer them to returning users as an import (recommended), or delete.
7. **Staging:** create a second App Hosting backend from a `develop` branch (recommended; small extra cost).
