# Template Authoring Guide and Release Checklist

**Read this before creating or changing a CV template.** Every rule below exists because a real defect shipped or nearly shipped during the November 2026 design sprint and three independent reviews (scores rose from 7.8 → 8.5 → 8.9). The engine now prevents most of these problems automatically; this guide explains what the engine guarantees, what a template author must still do, and how to prove a template is ready.

Related: `template-engine.md` (architecture), `../ux/design-system.md` (app UI, not CV styling), `testing-and-qa.md`.

---

## 1. Design principles (what "excellent" means here)

1. **One signature idea per template.** A memorable element (sidebar, timeline, label column, framed photo…) — not a new colour of an existing layout. Write it in one sentence in the template's doc comment before coding.
2. **Reading efficiency beats decoration.** Reviewers consistently penalised oversized headers, wide decorative columns and tiny supporting text. Decoration must not cost the content its space.
3. **The document is the product.** Judge templates as exported PDFs at 100% zoom, never from the editor preview or from code.
4. **Valid identities are allowed.** Colour bands, sidebars, pills and chips are legitimate design choices. Do not remove a template's character to please one reviewer; fix *usability* problems inside the identity.
5. **Content order belongs to the user.** Never reorder sections to make a layout work. Templates may only decide *which column* a section kind goes into.

## 2. Budgets every template must respect

| Item | Budget | Why |
|---|---|---|
| Body text | Density scale only (9.8 / 10.5 / 11 pt). Never set body size in a template | Reviewers flagged 9–10 pt as too small |
| Supporting text (dates, issuers, meta) | ≥ 0.86em of body and colour `--ink-2` or `--ink-3`, not lighter | "Dates too small and light" (Halo, Folio) |
| Header (page 1) | ≤ ~22% of page height with photo | "Header occupies a quarter of the page" (Halo, Meridian) |
| Side column / sidebar | ≤ 33% of page width including bleed; label columns ≤ 22% of content width | "Sidebar takes more than a third" (Atelier), "label column wastes width" (Ledger) |
| Portrait | 25–34 mm | Larger portraits pushed content down |
| Contact text | ≥ 0.95em of body | "Contact information is small" (Meridian, Chronicle, Heritage) |
| Gap above page number | Provided by base CSS (bottom padding); never reduce page bottom padding | "Final job finishes close to the page number" (Ledger) |
| Line length | ≤ ~95 characters at body size; single-column templates need generous margins or a gutter | Sprout's full-width lines were hard to read |

## 3. What the engine guarantees (do not re-implement or fight these)

| Guarantee | Mechanism | Defect it prevents |
|---|---|---|
| PDF text extracts in document order | Every `[data-block]` is `position: relative` (base CSS) | Bullets extracted after all sections (9 of 10 templates, review 1) |
| Clickable contact and project links | `ContactList` and `MetaText`/`SubMeta` render `<a href>` | "No link annotations" (review 1), "project URL not clickable" (review 2) |
| Addresses wrap at `@` and `/` only | `breakable()` inserts `<wbr>` | `example.` / `com` split (Folio) |
| Headings never stranded | Heading blocks are `keep="with-next"`; planner checks the successor fits | "Skills" heading alone on page 1 (Vivid) |
| Ordinary jobs never split | Entries with ≤ 6 bullets are chained whole (`KEEP_WHOLE_ENTRY_MAX_BULLETS`) | Page 2 starting with stray bullets (Vivid Letter, review 3) |
| Long lists split sensibly | Skill groups > 8 items split into chunks of 6 when `hooks.splitSkills` or tag style | Whole 24-skill group moved to page 2 (Atelier, Vivid, Sprout) |
| No single list item stranded | `listKeep()` | Lone "Twi" on page 2 |
| No near-empty extra page | Fit pass (tighter gaps/margins/line height, never smaller text) when last page < 30% full | Chronicle/Heritage one-line page 2 (review 2) |
| Continuation pages use full width | `cv-page--wide` after side-column content ends | Empty right column on page 2 (Vivid) |
| Side column background can end with its content | `--aside-h` per page; or tint the blocks themselves | Full-height tint for one small block (Meridian, Sprout) |
| Continuation header name/role never touch | Base CSS gives `[data-slot="running"] > *` a 2.5em gap and wrapping | 0.32 pt gap between name and role (Clarity) |
| Fonts embed as TrueType with Latin-Extended coverage | Static fonts in `font-catalog.ts` | Type 3 fonts in every PDF; missing "ğ" in Lato |
| Contrast-safe accents | `resolveDesign()` darkens accents to ≥ 4.5:1 | Unreadable custom colours |
| Balanced wrapping | `text-wrap: pretty` (p, li) and `balance` (h1–h3) | Lone "(B)" on its own line |

If a template needs behaviour the engine does not provide, **add it to the engine with a test**, not as a template-specific hack.

## 4. Coding rules for templates

1. **Never build class names with template literals.** The Tailwind Prettier plugin trims spaces inside `className={`…`}` strings and silently glued `b-skills b-first` → `b-skillsb-first` and `cv-contacts-wrap cv-contacts--stacked` → `cv-contacts-wrapcv-contacts--stacked`. Use `classes(...)` from `blocks.tsx`.
2. **Blocks use padding, never margins**, for vertical spacing (heights must be additive for the planner).
3. **Vertical size of a block must not depend on which page it lands on.** Styles under `.cv-page--first`/`--rest` may change colour or horizontal bleed only. Use negative horizontal margins + matching padding for bleeds (content width unchanged).
4. **Do not make the side column shrink to its content** (`align-self`, `height:auto`): the planner reads its height as page capacity. Tint the blocks instead (see Sprout) or use `--aside-h`.
5. **Absolute positioning only for decoration.** Text that is absolutely positioned is not measured and can overlap (Ledger's first label overlapped the next section). Use `hooks.label` for label columns — it puts the label in real flow.
6. **Never rely on a later CSS rule overriding a base rule of equal specificity by accident.** A late `.cv-contacts--icons .cv-contacts{margin-left:-1.4em}` hid every stacked icon. Check computed styles in a browser when something "doesn't apply".
7. **Target the right element.** The running header is wrapped in `[data-slot="running"]`; a rule on `.cv-top--running > *` styled the wrapper and silently did nothing (review 3). Verify with a measurement, not by reading CSS.
8. **Glyphs must exist in the template's fonts.** Decorative characters (◆, ✓, arrows) fell back to system fonts and became Type 3. Draw shapes with CSS or use characters verified in `font-catalog.ts` families.
9. **Photo templates must look intentional without a photo**: either `fallback="initials"` or a layout that closes up cleanly.
10. **Contacts in a side column** (`contactsIn: 'aside'`) must use `ContactList stacked icons`; labels are hidden in stacked mode.
11. **Every template must declare** `photo`, `tags`, `support.defaults.fontPair`, `asideKinds`, a `Running` header and a one-sentence description.
12. **Look good in all five font pairs**, not only the recommended one; spot-check at least two.

## 5. Proving a template is ready (release checklist)

Run all of these. A template is not done until each box is ticked in its PR description.

**Automated**
- [ ] `npm run verify` (lint, types, unit tests incl. class-name integrity and content preservation across templates).
- [ ] `npm run qa:templates` and `PHOTO=1 npm run qa:templates` and `PAGE_SIZES=Letter PHOTO=1 …` — zero `FAIL`, zero `NEARLY-EMPTY-LAST-PAGE`.
- [ ] `npm run test:e2e` — includes for every template: preview pages = PDF pages, fonts embedded and not Type 3, text order (bullet before next job and before education), `mailto:`/`tel:`/project links, no stray bullets on any continuation page (A4 + Letter), running-header gap, gallery and picker.
- [ ] `npm run templates:thumbs` to refresh picker thumbnails.

**Visual review (at 100% and at page-overview size)** with these fixtures: driver (short), teacher (two-page on Letter), nurse, graduate, engineer (long), executive, sparse (name only), extreme (long name/email/URL, accents, 12 bullets, 24 skills) — with and without photo, A4 and Letter.
- [ ] Signature idea is obvious at thumbnail size.
- [ ] Hierarchy: name → role → section titles → entry titles → body → details is unmistakable.
- [ ] Budgets in §2 hold (measure header height, column widths, smallest text size).
- [ ] No page begins with orphaned content; no near-empty last page; no empty side column on continuation pages.
- [ ] Long name, role, email and URL wrap at sensible points; continuation header stays readable.
- [ ] Sparse CV looks deliberate, not broken.
- [ ] Extracted text (`pdftotext -raw`) reads in visual order.

**Independent review**
- [ ] Before claiming a score, send samples + stress tests + Letter exports to a reviewer who did not build it. Our own first scores (9.5) were 1.5–2 points higher than independent reviews; calibrate against theirs.
- [ ] For each finding: verify in the PDF, then fix or reject with a written reason (see STATUS phases 3c–3e for examples).

## 6. Review history (for calibration)

| Round | Avg score | Main findings |
|---|---|---|
| Self-audit | "9.5" | Overconfident; missed reading order and links |
| Review 1 | 7.8 | Reading order, no links, small text, empty page-2 column, wide sidebars/labels, Folio wrapping |
| Review 2 | 8.5 | Near-empty extra pages (regression from larger text), oversized groups, running header gap, project links, Meridian tint |
| Review 3 | 8.9 | Running header fix targeted wrong element; light Letter page 2 (declined: users get a "Fit on one page" prompt); split ordinary jobs |
