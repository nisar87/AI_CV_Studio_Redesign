# Competitor Research

Research date: November 2026. Sources: vendor sites, independent comparisons and user reviews (links at the end). Prices change often; they are listed only to show the business model, not as current fact.

## Summary table

| Product | Strength worth learning from | Weakness we can beat |
|---|---|---|
| **Resume.io** | Clean, quick editor; conservative templates that parse well in ATS | Low-price 7-day trial auto-renews into a ~4-weekly subscription; frequent billing complaints |
| **Zety** | Easiest start for first-timers; section-by-section writing tips; content scoring | Same trial-to-recurring model; download locked behind payment; users report losing access to documents after cancelling |
| **Novorésumé** | Visually refined, clean templates; genuinely free one-page tier | Free PDFs carry branding; flags issues but leaves writing to the user |
| **Kickresume** | All-in-one hub (CVs, letters, website); strong AI first drafts; questionnaire-style generation | Large template catalogue of uneven quality; some ATS formatting issues reported |
| **Enhancv** | Direct editing on the page; rewrites the user's own content; job-specific tailoring | Testers caught its AI inventing numbers; dense for non-experts |
| **Teal** | Best job tracker; per-job match score; generous free tier | Resume builder secondary to tracker; learning curve; aimed at heavy job hunters |
| **Canva** | Unmatched visual freedom and template browsing; instant visual feedback | Many designs parse poorly in ATS; easy to break layouts; not CV-aware |
| **Reactive Resume** (open source) | Real-time preview, section drag-and-drop, JSON data model separated from templates, Chromium/React-PDF rendering | Built for technical users; generic look |

## User-journey patterns observed

1. **Entry:** "Create new / Upload existing" fork (Resume.io, Zety, Teal). Upload is valued but brittle on image PDFs.
2. **Template first vs. content first:** Zety and Resume.io ask for a template before content; Teal and Kickresume start with content. Picking a design before having content makes previews look empty and misleading. **Our choice:** content first, with the design suggested automatically and changeable at any time with real content shown.
3. **Editor shape:** split screen (form left, live preview right) is the industry standard on desktop. On-page editing (Enhancv, Canva) is intuitive for small fixes but fiddly for structured data. **Our choice:** split view with a guided form; click-to-jump from preview to the matching field.
4. **AI placement:** best experiences put AI *inside* the field being edited ("Improve this", "Write a summary from my experience") rather than a separate chat. Chat is good for the first description and for design intent.
5. **Paywall moment:** most competitors gate at download, after users have invested their time. This is the single biggest source of anger in reviews.

## What is unnecessarily complicated elsewhere

- Score dashboards with many numbers (ATS score, impact score, keyword density) that intimidate first-time users.
- Hundreds of templates that differ by a colour or an icon.
- Asking for every possible section up front (publications, references, hobbies) regardless of profession.
- Rich-text toolbars inside every field.

## Opportunities for AI CV Studio

| Opportunity | Product response |
|---|---|
| Ordinary workers are underserved by tech-oriented tools | Profession presets that ask the right questions (driver, nurse, teacher, retail, trades, office, tech, executive) |
| Distrust of AI "making things up" | Visible "needs your confirmation" markers on any AI-suggested fact; nothing invented |
| Billing distrust | Free PDF download of a complete CV, always |
| Design vs. ATS trade-off | Every template ATS-safe by construction: real text, logical reading order, no text in images, single text layer |
| Template fatigue | A small set of strong templates, each with meaningful variations (colour, font pairing, density), plus "describe your style" |

## Sources

- Enhancv: best resume builders comparison (2026) — enhancv.com/blog/best-resume-builders
- Rework: best AI resume builders 2026 — resources.rework.com
- Dupple: best AI resume builders, prices checked Oct 2026 — dupple.com/learn/best-ai-resume-builders
- Unstar: resume builder apps ranked by 1-star reviews — unstar.app
- LoopCV directory: Zety and Teal reviews — loopcv.pro
- PitchMeAI: Resume.io review — pitchmeai.com
- Reactive Resume repository and architecture docs — github.com/AmruthPillai/Reactive-Resume, docs.rxresu.me
- Weekday: Teal review (Oct 2026) — weekday.works
