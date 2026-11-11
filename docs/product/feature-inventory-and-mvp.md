# Feature Inventory and MVP

Priority expresses importance — **P0** must be in the MVP (Phases 1–4), **P1** needed for the first public release (Phases 5–6 + launch hardening), **P2** growth (Phases 7–10), **Idea** = not scheduled. The Phase column says when it is scheduled (`../delivery/roadmap.md`); a P1 item scheduled in an MVP phase may slip without blocking the MVP.

## MVP definition

> A person with no CV and no technical knowledge can describe what they do, answer a short guided set of questions, receive a professional CV in a strong template, adjust its look in plain-language terms, get honest AI help with wording, and download a PDF identical to what they saw — without creating an account.

MVP explicitly **excludes**: accounts and cloud sync, payments, uploads/import of existing files, job tailoring, cover letters, portfolios, multi-language UI. These are deliberate cuts to keep the first release excellent.

## Inventory

### CV and Resume Studio
| Feature | Priority | Phase | Notes |
|---|---|---|---|
| Structured resume document (independent of design) | P0 | 2 | Core of everything; see data model |
| Profession presets (which sections, which hints, which template) | P0 | 3 | ~8 presets + "Something else" |
| Guided step-by-step creation | P0 | 3 | Mobile-first wizard; skippable steps |
| Full editor: split form + live preview | P0 | 3 | Click preview to jump to field |
| Add / remove / reorder / hide sections and entries | P0 | 3 | Keyboard-accessible reordering (buttons, not drag-only) |
| Undo / redo of edits | P0 | 3 | Session history; plus autosave |
| Autosave locally, "Continue your CV" | P0 | 3 | IndexedDB/localStorage |
| Multiple CVs on one device | P0 | 3 | Simple list: duplicate, rename, delete (with undo) |
| Custom sections (title + entries) | P2 | 8 | Data model supports from day one |
| Versions linked to a master CV | P1 | 5 | Created by job tailoring |
| Import: paste text | P1 | 5 | AI-structured, user-confirmed |
| Import: PDF/DOCX upload | P1 | 5 | Text extraction; fall back to paste |
| Import: JSON Resume file | P1 | 5 | Cheap and useful for technical users |
| Profile photo | P0 | 3b | Optional; 9 of 10 designs can show it; resized locally |

### Design Studio
| Feature | Priority | Phase | Notes |
|---|---|---|---|
| 10 designs, all ATS-safe, each with a signature idea | P0 | 2–3b | See `../engineering/template-engine.md` |
| Template switch without losing content | P0 | 2–3 | Guaranteed by data/design separation |
| Accent colour (curated palette + custom with contrast guard) | P0 | 3 | |
| Font pairing (4–5 curated pairs) | P0 | 3 | |
| Density (compact / balanced / airy) and margins | P0 | 3 | |
| Style cards ("Calm & classic"…) for non-designers | P0 | 3 | Presets over the above controls |
| Describe your style in words → validated design spec | P0 | 4 | AI chooses from supported options only |
| 2–3 AI alternatives to compare | P1 | 4 | |
| Additional templates beyond 10 | P2 | 8 | Only after passing the quality checklist |
| Section-level layout options (e.g. skills as list/columns) | P2 | 8 | |

### Export and sharing
| Feature | Priority | Phase | Notes |
|---|---|---|---|
| PDF download (server Chromium, identical to preview) | P0 | 2 | Free, always |
| Print from browser (same document) | P0 | 2 | Fallback if PDF service unavailable |
| A4 and US Letter | P0 | 2 | Default from locale |
| JSON backup download / restore | P0 | 3 | Data ownership without accounts |
| Plain-text export (for pasting into job portals) | P1 | 5 | |
| DOCX export | P2 | 8 | Many employers/recruiters request Word |
| Share link (read-only web CV) | P2 | 9 | Requires account |

### AI assistance
| Feature | Priority | Phase |
|---|---|---|
| Describe what you need → profession + section plan + starter content | P0 | 4 |
| Write / improve summary from confirmed facts | P0 | 4 |
| Improve a bullet / description (clearer, stronger verbs, no new facts) | P0 | 4 |
| Suggest skills for a role (user picks) | P0 | 4 |
| Design intent interpretation | P0 | 4 |
| Spelling and grammar polish | P1 | 4 |
| CV review checklist (specific, explainable) | P1 | 5 |
| Job description analysis + tailoring | P1 | 5 |
| Translation of a CV | P2 | 10 |

### Accounts and platform
| Feature | Priority | Phase |
|---|---|---|
| Sign in with email magic link / Google | P1 | 6 |
| Cloud sync of CVs; move local CVs into account | P1 | 6 |
| Delete my account and data | P1 | 6 |
| Usage limits on AI (fair-use, abuse protection) | P0 | 4 |
| Pricing and payments | P2 | after 6, separate ADR |
| Admin tools | Idea | — |

### Cover letters and applications (Phase 7, P2)
Job-specific cover letter matching CV design; application email (subject + body); follow-up email; thank-you note; short introduction message. One "Application kit" per job.

### Portfolio and personal branding (Phase 9, P2)
Public portfolio page from CV data plus projects; 2–3 themes; custom slug; professional bio generator.

### Career intelligence (Phase 10, P2)
Resume-to-job match explanation, skill-gap list, interview question practice, LinkedIn headline/about suggestions.

### Ideas (not scheduled)
Application tracker, multi-language UI, RTL scripts, coach/team workspaces, browser extension to capture job ads, video CV.

## Why this cut

- The CV is the thing every user needs; it must be excellent before anything else is built on top.
- AI is in the MVP because "describe it, get it" is the product's identity — but only narrow, validated AI tasks.
- Accounts are deferred because local-first lets users start in seconds and keeps privacy simple; sync is valuable but not needed to get a first CV out.
