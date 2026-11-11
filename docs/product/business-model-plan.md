# Business Model Plan — accounts, Premium, payments and import

_Status: proposal for owner approval · 2026-11-12_

## 1. What changed

The redesign was planned as a free, no-account product. That was wrong: AI CV Studio is a **paid product**. AI costs money on every request, and the domain, hosting and maintenance are ongoing costs. The old application already had the business layer:
- login,
- free vs Premium limits,
- manual payments (JazzCash, EasyPaisa, bank) approved by an admin,
- import of an existing CV.

The earlier review of the old app (`old-project-review.md`) filed this layer under "premature platform work". That judgement was mistaken and is withdrawn.

**Already done (2026-11-12):**
- AI help is paused on the live site (`AI_PROVIDER=off` in `apphosting.yaml`).
- The "Free · No sign-up" claims are removed from the site.
- The CV builder and PDF download still work.

**Owner decisions so far:**
- Manual payments, as in the old app.
- Free designs: **Clarity, Chronicle and Heritage**. The other 7 designs are Premium.
- Plan first, and do not rebuild everything the old app had.

## 2. Why the old application failed here, and the rules that follow

The old repository shows the pattern clearly:
- Entitlement checks were added screen by screen in dozens of "waves" (Wave 1-D … 1-P). Each wave patched another path where a limit could be bypassed.
- Usage counters lived on the device, so clearing the browser reset them.
- The security rules were written but never deployed.
- Prices, receivers and payment methods stayed as placeholders.
- Large side systems were built before one paying user existed:
  - LinkedIn scraping,
  - a custom AI template generator,
  - an email notification queue,
  - an admin "business settings" editor.

**Rules for the new product:**

1. **One gate, on the server.** Every paid capability is checked in one module (`src/modules/billing/entitlements.ts`) and called only by the server routes that cost money or deliver paid value:
   - `/api/ai/*`
   - `/api/pdf`
   - `/api/import`

   The browser only *shows* what the server allows. A user who edits the page gains nothing.
2. **Counters live on the server** (Firestore, written only by the server), never on the device.
3. **Ship the thinnest complete paid path first.** The path is: sign in → ask for Premium → pay → admin approves → Premium works. No new paid feature is added until a real user has completed this path.
4. **Configuration is a code file until it is changed often.** Prices, payment accounts and free designs live in `src/modules/billing/plans.ts`. An admin settings editor is built only if the owner changes these more than about once a month.
5. **Every AI feature has a cost ceiling:**
   - a per-user monthly allowance,
   - the existing global daily budget switch.
6. **Not building now**, until data shows a need:
   - LinkedIn scraping (cost and terms-of-service risk),
   - a custom AI template generator,
   - email notification queues,
   - coupons,
   - saved-CV caps,
   - cloud backup,
   - card payment gateways.

## 3. The model (one page)

| | Visitor (no account) | Free account | Premium |
|---|---|---|---|
| Create, edit and preview a CV | ✅ | ✅ | ✅ |
| Designs | Preview all 10 | Use Clarity, Chronicle, Heritage | All 10 |
| Download PDF | ❌ (asked to sign in) | ✅ free designs, **3 per month** | ✅ all designs, fair use (100 per month) |
| Import an existing PDF or Word CV | ❌ | ✅ **2 per month**, into free designs | ✅ fair use (30 per month) |
| AI help (writing, describe-a-style, skills, job tailoring) | ❌ | ❌ (shows the Premium offer) | ✅ **300 AI actions per month** |
| Where CVs are saved | This browser | This browser | This browser (cloud sync later) |

**Why these choices:**

- **Visitors build before signing in.** People see the value before we ask for anything. Sign-in is required only to download, so every download is tied to an account.
- **Import is free for free designs.** This is your stated hook: "I have a CV, put it in a better design." It is also the cheapest way to win users. Each import costs one cheap AI call (Gemini Flash, a fraction of a cent), capped at 2 per month.
- **No saved-CV limit.** CVs stay in the browser, so a server cannot count them honestly. The old app spent many waves on this cap and it was still bypassable.
- **Premium is a time-limited pass, not a subscription.** Manual payments cannot renew themselves. A pass has an `expiresAt` date and stops by itself.

**Prices are the owner's decision.** The old app's provisional prices were PKR 499 and PKR 1,299. Proposal:
- **PKR 499 for 1 month**,
- **PKR 1,299 for 3 months**.

The numbers in the table are starting values in `plans.ts`, easy to change.

## 4. How it fits the existing system

**Login: Firebase Auth in the existing project `ai-cv-studio`.**
- The old users' accounts are still there and can sign in to the new app unchanged.
- Methods: email + password (with verification and password reset) and Google.
- No custom password rules beyond what the Firebase project already enforces.

**The server knows who is calling.**
- The browser sends the Firebase ID token.
- The Next.js server verifies it with `firebase-admin`, using the App Hosting service account.
- No secrets are stored in the app.

**Premium record:** `users/{uid}/entitlements/current`, the same path and fields as the old app (`plan`, `status`, `activatedAt`, `expiresAt`, `source`).
- Old Premium users are honoured automatically while their record is active and not expired.
- Only the server or admin can write it (Firestore rules, **deployed** this time and covered by tests).

**Usage:** `users/{uid}/usage/{yyyy-mm}`, holding counters for downloads, imports and AI actions.
- They are incremented atomically by the server in the same request that does the work.
- A failed request is not counted.

**Payments:** `paymentRequests/{id}`, the same shape as the old app.
- The user chooses a pass and pays to one of the configured accounts (JazzCash, EasyPaisa or bank).
- They submit the transaction reference, the payer name and the date.
- The request then shows as "pending".

**Admin:** one page, `/admin/payments`. It is visible only to accounts with the `admin` custom claim (the old app's owner claim if it is still set; otherwise one command sets it). It lists pending requests with:
- **Approve:** writes the entitlement with `expiresAt` and an audit record.
- **Reject:** records a reason the user sees.

It can also grant or revoke Premium by email (for support cases). Nothing else.

**AI:** the existing Phase 4 module, with one addition. Each request checks Premium (or the free import allowance) and counts usage. The truth guard, the limits and the global budget stay as they are.

**PDF:** `/api/pdf` checks:
- that the design is allowed for the plan,
- that the monthly allowance is not used up.

Then it renders as today.

## 5. What users see

- **Locked designs** show a small "Premium" badge. Choosing one previews it fully.
- **Downloading a locked design** shows a short card: "This design is part of Premium", with the price and "Get Premium", or "Use a free design instead".
- **AI buttons stay visible** for free users. Pressing one opens the same card, with one line on what AI does.
- **The account page** shows the plan, the expiry date, this month's usage and payment request status.
- **The "Get Premium" page** shows:
  - the passes and prices,
  - the accounts to pay to,
  - a short form,
  - a clear promise: "We activate your pass after checking your payment, usually within X hours".

The owner decides X.
- **Honest copy everywhere.** No "free" claims beyond what the table above gives.

## 6. Revised roadmap

| Phase | Scope | Done when |
|---|---|---|
| **4b · Accounts and plans** | Sign-in (email + Google) and the account page; server token check; `plans.ts` and the single entitlement gate; downloads need sign-in; design and AI gates; monthly counters; Firestore rules deployed with tests; AI switched back on for Premium only | E2E: a visitor cannot download; a free user downloads a free design 3 times, then sees the limit; a free user cannot use AI or a Premium design (server refuses even with a crafted request); a Premium test user can; an old Premium account works |
| **4c · Get Premium (manual payments)** | Get Premium page; payment request form; `/admin/payments` approve, reject, grant and revoke; expiry; audit log | The owner completes a real end-to-end payment with a test account on the live site, and the pass expires correctly (tested with a short pass) |
| **5a · Import** | Upload PDF or Word (`.docx`); server text extraction; AI `import.structure` into the CV model, with uncertain fields flagged for review; free allowance 2 per month | 10 real CVs (PDF and Word, varied layouts) import with no invented facts and every section placed; a free user can import and download in a free design |
| **5b · Job tailoring** (Premium) | Paste a job advert, see matches and gaps, and get a tailored copy of the CV | As in the original Phase 5 criteria |
| Later, only if data shows need | Cloud sync, card gateway (needs a registered business), admin settings editor, cover letters, coupons | — |

Phase 4's remaining acceptance item, the live truthfulness evaluation (`npm run ai:eval`), is run during 4b. It runs before AI is switched back on for paying users.

## 7. Measures (so we know if it works)

All counted from server events, with no CV content.
- Visitors who start a CV.
- Sign-ups at the download step.
- Free downloads.
- Imports.
- Premium cards shown, and "Get Premium" clicks.
- Payment requests, and approvals.
- Average AI cost per Premium user per month, compared with the price.

We review these after the first 2–4 weeks before building anything in "Later".

## 8. Decisions needed from the owner

1. **Prices and durations:** the proposal is PKR 499 for 1 month and PKR 1,299 for 3 months.
2. **Free account allowances:** the proposal is 3 downloads and 2 imports per month, with no AI.
3. **Payment accounts:** JazzCash, EasyPaisa and/or bank details, and the promised activation time.
4. **Old users:** should old Premium records be honoured until they expire? (Recommended: yes.)
5. **Old data:** the old app's saved CVs in Firestore (`users/{uid}/savedCvs`). Keep them (the old app could show them to signed-in users later) or delete them. Recommended: keep until 5a, then decide.
