# Vision and Positioning

## One sentence

AI CV Studio turns what you know about your own working life into a professional CV — and later the letters, emails and portfolio around it — without you needing to know anything about design, formatting or AI.

## The problem

Most people write a CV a few times in their life, under stress, with tools that assume they already know what a "summary section", an "ATS" or "two-column layout" is. The market's answers fall into three camps, each with a sharp failure:

| Camp | Examples | What goes wrong for ordinary users |
|---|---|---|
| Form-based builders | Resume.io, Zety, Novorésumé | Long forms; the free download is locked behind trial subscriptions that auto-renew at ~10× the trial price; generic AI bullet points |
| Design canvases | Canva | Beautiful but easy to break; many designs parse badly in applicant tracking systems; blank-canvas anxiety |
| Job-search suites | Teal, Enhancv, Careerflow | Powerful but dense; built for heavy job hunters, not a nurse updating a CV once in five years; some AI "improvements" invent numbers |

## Our answer

**Conversation in, professional document out.** The user says, in their own words, what they need ("a simple CV for a delivery driver job", "modern blue CV for a school teacher"). The Studio asks only for what that kind of CV actually needs, fills a structured document, and lays it out with a genuinely professional template. Everything stays editable, and nothing the AI writes is treated as fact until the user confirms it.

### Positioning statement

For people of every profession who need a strong CV without becoming CV experts, AI CV Studio is the career studio that produces a professional, honest, ready-to-send document from a plain-language description. Unlike subscription-trap builders and AI tools that embellish, it is truthful by design, never locks your own CV behind a paywall, and makes every design decision for you — while letting you change any of them.

### Differentiators we will defend

1. **Describe it, get it.** Natural-language design and content requests, interpreted into safe, structured choices (never free-form AI layouts).
2. **Truthful AI.** AI rewrites, organizes and suggests; it never invents employers, dates, qualifications or numbers. Anything uncertain is flagged for the user to confirm.
3. **Profession-aware, not one-size-fits-all.** A driver's CV asks for licence categories and routes; a nurse's for registration and clinical areas; an engineer's for projects. Short CVs are not "incomplete".
4. **Print-perfect documents.** One rendering path for preview and PDF, so what you see is exactly what you send. Pages break where a professional would break them.
5. **Honest pricing.** Your basic CV is always downloadable as a PDF for free. Paid features are clearly priced, with no trial-to-subscription traps. (Monetization is out of MVP scope; this principle constrains it.)
6. **Calm, plain-language interface.** No jargon, no dashboards full of scores, one clear next step on every screen.

## Long-term vision

A personal career studio where one profile powers many outputs, each kept consistent in voice and visual identity:

```
                ┌───────────────────────────┐
                │  Career Profile (truth)    │  ← the user's facts, confirmed by them
                └─────────────┬─────────────┘
       ┌───────────┬──────────┼───────────┬─────────────┐
       ▼           ▼          ▼           ▼             ▼
   CVs (many    Cover      Application  Portfolio    Career
   versions)    letters    emails       & website    insights
```

The MVP ships the first box well. Later phases add the rest without changing the core model (see `feature-inventory-and-mvp.md` and `../delivery/roadmap.md`).

## Success measures

| Measure | MVP target |
|---|---|
| Time from landing to first downloaded PDF (new user, guided path) | < 10 minutes median |
| Users who finish the guided flow once started | > 60% |
| PDF matches on-screen preview (page count and breaks) | 100% in automated fixtures |
| Templates passing the quality checklist across all profession fixtures | 100% of shipped templates |
| AI outputs that introduce unconfirmed facts (sampled review) | 0 tolerated; any instance is a P1 bug |

## What we are not

- Not a job board or auto-apply bot.
- Not a free-form design tool. Users customize within professional guard-rails.
- Not a native mobile or desktop app. Web only, responsive down to phones.
