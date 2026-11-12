# AI CV Studio — Studio Master Plan

_Status: **approved by the owner 2026-11-12** · Replaces `business-model-plan.md`_

_Implementation: **Releases 1–4 are live on aicvstudio.app (2026-11-12)**; card gateway and Urdu deferred. This plan was updated on 2026-11-12 to match the program; each place where the build differs from the original plan says so. Status per feature: §10 and `docs/STATUS.md`._

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
- Every release is **live with real users** before the next one starts. *(As built: on the owner's instruction "keep working, do not wait", R2–R4 were built and released back to back on 2026-11-12, each verified on production before the next. Sales opened the same day, so real-user numbers start now.)*
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

- **Facts live once.** They live in the profile. Documents choose and phrase those facts. *(As built: the career profile is a CV marked as the profile; new and tailored CVs are copies of it. Edits made in a copy are not offered back to the profile — the "Update your profile too?" prompt is not built yet.)*
- **Every output uses the same template engine.** Design tokens are shared, so a letter matches its CV and the portfolio page matches both. *(As built: CVs and cover letters print through the template engine; the portfolio page takes the CV's accent colour and heading style; Word files are a clean single-column export of the same content.)*
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
| Career profile, CV health check | — | ✅ | ✅ |
| Designs | Preview all | All designs that are set to Free (today: all 10; recommended Free set: Clarity, Chronicle, Heritage) | All |
| Downloads (PDF and Word share one count) | Sign in first | 30 / month | 100 / month |
| Import PDF/Word CV | Sign in first | 2 / month | 30 / month |
| Share links for CVs | — | ✅ | ✅ |
| Job tracker | — | Up to 3 jobs | Unlimited |
| AI writing, describe-a-style, skills, job match, tailored CV, cover letter + email, interview preparation, LinkedIn writer | — | Offer shown | ✅ 300 AI actions / month |
| Portfolio page | — | — | ✅ |
| Saved CVs | Device only | 200 (safety cap) | 200 (safety cap) |

*(Updated 2026-11-12 to the values configured on production. The original proposal had 3 downloads/month and 5 saved documents for free accounts; the owner's starting configuration is more generous. All values are edited in Admin → Settings.)*

**Premium is a time-limited pass** (for example 1 month or 3 months), not an auto-renewing subscription:
- It suits manual payment (JazzCash, EasyPaisa, bank).
- It matches our "no subscription traps" promise.

A card gateway can add renewals later behind the same billing interface (§4.5).

## 4. Architecture: three foundations, then features

### 4.1 Foundation A — Identity and the Career Profile

- **Firebase Auth** in the existing project `ai-cv-studio`:
  - email + password (verification, reset) and Google sign-in, with an 18+ confirmation,
  - old accounts can still sign in; by the owner's decision (§9, fresh start) no old CVs or Premium records were carried over.
- **Server sessions.** Next.js verifies the Firebase ID token with `firebase-admin` and sets a short-lived, httpOnly session cookie.
- **Firestore data, owned by the user** *(as built)*:
  - `users/{uid}` profile basics (plus invite code and who invited them),
  - `users/{uid}/documents/{id}` with `versions/` (CVs; the Career Profile is a CV with `role: "profile"`),
  - `users/{uid}/jobs/{id}` (each job holds its match result, cover letter, application email and interview notes).
- **Local-first editing is kept.** Autosave writes locally, then syncs to the cloud. A visitor's CVs move into the account on sign-up. Conflicts use "last edit wins", with the previous version kept in history.
- **The existing document schema (Zod) stays the contract.** Each document type adds its own schema.

### 4.2 Foundation B — Document engine (already built, extended)

- One render path (HTML → paginated preview → identical PDF) serves **every document type**.
- Templates declare which document types they support. A "family" shares tokens, so the CV, letter and portfolio match. *(As built: the cover letter is rendered from the CV's own design settings; templates do not yet declare document types.)*
- The template authoring guide and quality gates apply to every new template and type.

### 4.3 Foundation C — Entitlements, usage and billing (the single gate)

```
request ─► requireUser() ─► can(user, capability, context) ─► do work ─► record usage (atomic)
                                  │
                       plan (from active pass) + limits (from config) + usage (this month)
```

- **One module, `src/modules/billing/`** *(as built)*:
  - `canUse()` / `canUseDesign()` decide (pure functions),
  - `reserve()` checks and counts atomically on the server, `release()` gives the count back if the action fails, so only successes count,
  - `denialCode()` and the decision's message produce the user-facing reason and offer.
- **Server routes call it**, never screens: `/api/ai/*`, `/api/pdf`, `/api/import`, document create, portfolio publish. The UI asks `/api/me/entitlements` only to *show* badges and offers.
- **Capabilities are a fixed list in code:** `pdf.download` (PDF and Word), `import.cv`, `ai.action` (all Premium AI, including letters, interview prep and LinkedIn), plus the design tier per design, the job limit (`maxJobs`) and the Premium check for publishing a portfolio. Which plan grants which capability, and how many times, is **data from the Admin Console**.
- **Data** *(as built)*:
  - Passes: `passes/{uid}`.
  - Usage: `usage/{uid}_{yyyy-mm}`, written only by the server.
  - Orders: `paymentRequests/{id}`; settings: `config/business` with versions.
- **Security:** the browser never reads or writes Firestore; all data access goes through the server (Admin SDK), so no user can write their own entitlement, usage, payment approval or config. *Not yet done:* Firestore security rules kept in the repo and deployed by CI with emulator tests, as a second wall.

### 4.4 The Admin Console (`/admin`)

Visible only to accounts with the `admin` custom claim, checked on the server for every admin request. Every change is written to an append-only **audit log** (who, when, before → after).

| Area | What the owner can do |
|---|---|
| **Dashboard** | New users, active Premium, pending payments, downloads (PDF and Word), imports, AI actions and failures, share/portfolio opens, invites and codes used, and **AI calls today against the daily budget** *(as built: calls, not rupees)* |
| **Users** | Search by email; see plan, pass expiry and usage; grant, extend or revoke Premium; reset a usage counter; disable an account |
| **Payments** | Waiting orders by order number, with the buyer's mobile and a WhatsApp link; approve (sets or extends expiry) or reject (reason shown to user); history including orders the buyer cancelled; duplicate transaction IDs refused |
| **Plans and pricing** | Edit plans, prices (PKR), pass durations, and which capabilities each plan has, with limits |
| **Designs (catalogue)** | For each design: shown, Free or Premium, "New" badge *(display order and recommended professions are not editable yet)* |
| **Features** | On/off switches: sales, AI (all tasks together), import, sign-ups, maintenance mode |
| **Payment methods** | JazzCash, EasyPaisa and bank accounts with copyable details; instructions; the WhatsApp number for payment screenshots; support email |
| **Growth** | Discount codes (% off and/or extra days, passes, use limit, last day); invite rewards (days for inviter and friend) |
| **AI** | Live AI evaluation on production; per-user monthly limits (in Plans) and the AI switch *(model and daily budget are server settings, not in the Console)* |
| **Content** | Site announcement banner and support email *(Help FAQ entries and offer wording are not editable yet)* |
| **Audit log** | Every admin change and payment decision, filterable |

**How settings work, which avoids the old divergence:**

- **One typed schema per settings area** (Zod), shared by the Console, the server and the tests. Invalid settings cannot be saved.
- **Stored in Firestore `config/business`** (one document for all areas) with a version number. Each save creates a new version, so **any previous version can be restored in one click**.
- **One resolver on the server** reads the config, falls back to code defaults only if a document is missing, and caches it for 60 seconds. Every page and API uses this resolver.
- **Public parts** (catalogue, plan names, prices, payment instructions) are served from one endpoint. Private parts (AI budget, limits) never leave the server.

### 4.5 Billing behind an interface

- **Manual payments, as built:** the buyer chooses a pass, pays by a listed method, enters their mobile number and places an order. They get an order number (`CV-XXXXXX`) and a WhatsApp button that sends the owner the order number and amount; they attach the payment screenshot. The owner approves in the Console. The transaction ID is optional, discount codes and invite bonuses are priced by the server, and a buyer can cancel an unpaid order.
- **Card gateway later.** The order and approval code is written for manual payments only; a `PaymentProvider` interface will be extracted when a card gateway (Stripe, Paddle, or a local PSP) is added, without changing the entitlement gate or the Console.
- **Approvals and grants** each write the pass and an audit entry in a single transaction.

### 4.6 Operations

- **Hosting.** Firebase App Hosting (live now). There are two backends: `aicvstudio` serves production from `main`, and a **staging** backend serves the `develop` branch for owner review before release.
- **CI** (GitHub Actions): lint, types, format, unit, e2e, template parity (including a run against the production PDF renderer), client-secret check; green on `main`. *Not yet: rules emulator tests; branch protection on `main` is to be confirmed in GitHub settings.*
- **Analytics.** Server-side events, with no CV content, feed the dashboard numbers and the success measures.
- **Error monitoring.** Structured logs plus a Cloud Monitoring alert on errors, 5xx and AI budget at 80% *(the alert needs an email channel added by the owner)*.
- **Email:** verification and password reset are sent by Firebase Auth. *Payment approved/rejected emails are not built; the buyer sees the result on the Premium page and the owner can reply on WhatsApp.*

## 5. What we take from the old app, and what we drop

| Take (as reference) | Drop |
|---|---|
| Firebase project and user accounts *(old Premium records and CVs not carried over: fresh start, §9)* | Flutter web front end |
| Manual payment flow (methods, admin approve/reject, audit) — *now with order numbers and WhatsApp screenshots* | Client-side entitlement checks and device counters |
| Admin areas (users, payments, plans, templates, settings, security log) | Admin email allowlist (the server `admin` claim only) |
| Password/verification UX decisions | LinkedIn scraping via Apify (cost and terms risk). A **LinkedIn profile writer** that produces text the user pastes is offered instead |
| CV health check and job match ideas | Custom AI template *generation* (unsafe layouts). "Describe a style" picks from the catalogue instead |
| Its lessons (§1) | The notification queue framework and stub sections |

## 6. Release plan (each release goes live and is used before the next starts)

### Release 1 — "Paid CV Studio" (the foundation release) — ✅ live

Goal: real people sign up, make CVs, import old CVs, buy Premium, and you run it all from the Console.

| Milestone | Scope | Done when |
|---|---|---|
| **R1.1 Identity and cloud documents** | Sign-in (email, Google), account page, server sessions; Firestore documents with sync; device CVs move into the account; old accounts work | A visitor's CV appears after sign-up on another device; an old user signs in; rules tests pass in CI *(rules tests not built, §4.3)* |
| **R1.2 Entitlement gate and config** | `billing` module; capabilities; usage counters; config resolver and schemas; `/api/me/entitlements`; downloads, designs and AI gated; Premium offer UI | A crafted request cannot bypass any limit (e2e); changing a design to Premium in config takes effect within 60 s |
| **R1.3 Admin Console v1** | Dashboard, Users, Payments, Plans, Designs, Features, Payment methods, AI, Audit log | Owner changes a price, a design tier and a limit, then restores the previous version, all without code |
| **R1.4 Get Premium (manual)** | Pass purchase page and order form (order number + WhatsApp screenshot, see §4.5); approval sets expiry; expiry ends access; *(emails for approved and rejected: not built)* | Owner completes a real payment end to end on staging, then on production |
| **R1.5 Import** | PDF and Word upload; server text extraction; AI `import.structure` into the profile and a CV, with uncertain fields flagged; free allowance | 10 real CVs import with no invented facts; a free user imports and downloads in a free design |
| **R1.6 Launch gate** | AI live evaluation (≥30 samples, 0 invented facts); accessibility and performance pass; privacy and terms text; staging backend; alerts | All gates green; AI switched on for Premium; release announced |

**Success numbers (first 4 weeks after R1):**
- Visitor → account rate at the download step.
- Free → Premium conversion.
- Payment approval time.
- AI cost per Premium user, which must stay under ~20% of the pass price.
- Import success rate.

### Release 2 — "Job-ready" — ✅ live

- Career Profile as its own page (/profile), with CVs copied from it.
- **Job tracker**: save a job advert, then track its stage and which documents were sent.
- **Job tailoring**: match and gap analysis with evidence from the profile, then a tailored CV version.
- **Cover letters and application emails** in matching designs.
- **CV health check**: explainable, specific, no fake scores.

### Release 3 — "Professional presence" — ✅ live

- **Portfolio page** at `aicvstudio.app/p/name`, published from the profile, with themes from the design system and simple visit counts.
- **LinkedIn profile writer**: headline, About section and experience text, ready to paste.
- **Share links** for CVs: read-only, can be switched off.
- DOCX export.

### Release 4 — "Growth and reach" — ✅ live except the deferred items

- Card payment gateway (once the business is registered). *Deferred.*
- Coupons and referral rewards. *Live (off until the owner switches them on).*
- More languages, starting with an Urdu interface and Urdu/English CVs if demand shows. *Deferred.*
- Interview preparation from the profile and job. *Live.*

Each later release is planned in detail only when the previous one is live, using its numbers.

## 7. How we work (so it does not drift)

1. **One release at a time.** A milestone is finished only when it is merged, deployed to production, its "done when" test is automated, and its numbers are visible on the dashboard.
2. **Staging first.** The owner reviews on staging and approves in one message; then it goes to production. *(In practice since 2026-11-12: the owner asked for work to continue without waiting for review, so changes go to production after the full automated run, and are then verified on the live site. Staging deploys from `develop` in step and remains available for owner review.)*
3. **Foundations are frozen interfaces.** Features use `requireUser`, `can/consume`, the config resolver and the document engine. They never work around them. Code review rejects bypasses.
4. **No placeholders in production.** Prices, accounts and texts are decided before the milestone that needs them (§9).
5. **Quality is automated.** Template gates, e2e journeys and unit tests run in CI; the live AI evaluation runs from the Console on production *(rules tests: not built yet)*. The owner judges the product, not regressions.
6. **Cut, don't stub.** If something cannot be finished in its milestone, it is removed from the UI rather than shown as "coming soon".

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI costs exceed revenue | Per-user monthly limits, global daily budget, cost on the dashboard, Flash-tier models, Premium-only AI except one cheap import call |
| Manual payment fraud or duplicates | The owner confirms funds (WhatsApp screenshot + EasyPaisa) before approving the order number; duplicate transaction IDs refused when given; audit log; pass expiry |
| Owner review becomes a bottleneck | Staging plus automated gates; the owner approves releases, not individual fixes |
| Old users confused by the new app | Same login still works. *(Fresh start decided, §9: the old app had no real users, so no Premium carry-over or welcome message was needed.)* |
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

## 10. Implementation status (2026-11-12)

| Area | Status |
|---|---|
| Releases 1–4 | Live on aicvstudio.app; Premium sales open (EasyPaisa + WhatsApp order flow) |
| Deferred by decision | Card payment gateway (business registration), Urdu interface (demand) |
| Planned but not built | "Update your profile too?" prompt; payment approved/rejected emails; AI model and budget, Help FAQ, offer wording, design order and recommended professions in the Console; AI cost in rupees on the dashboard; Firestore rules deployed by CI |
| Built beyond the original plan | Order-number checkout with WhatsApp and buyer cancel; Word export shares the download count; accessible-PDF checks in CI; shared daily AI budget across server instances |
| Next | Plan the next release from the first weeks of real numbers in Admin → Overview (§6) |

Full feature-by-feature status and the complete user and owner workflows: the project document *AI CV Studio — Master Document: Workflows and Implementation Status*, and `docs/STATUS.md`.
