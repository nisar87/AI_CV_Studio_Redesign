# CV Template Engine

The template engine is the heart of the product. Its job: turn a `ResumeDocument` into pages that look professionally designed, break across pages like a typesetter would, and come out of the PDF exactly as they appeared on screen.

## Lessons that shaped this design

- The previous product used separate canvas, preview and PDF renderers; parity never held. → **One renderer.**
- AI-authored layouts were unstable and samey. → **AI configures; it never draws.**
- Many templates, none excellent. → **Three launch templates with a strict quality checklist.**

## Pipeline

```
ResumeDocument (content + DesignSpec)
        │  normalize: drop hidden/empty, format dates, resolve section titles
        ▼
RenderModel (sections → blocks, all strings final)
        │  template component (pure React, server-renderable)
        ▼
Flow markup: blocks tagged data-flow="main|aside", data-keep="with-next|together"
        │  buildDocumentHtml(): + template CSS + design tokens + fonts + paginator runtime
        ▼
Self-contained HTML document  ──►  Preview iframe (browser)  ──┐
                               └►  Chromium page.pdf (server) ─┴─ same DOM, same paginator, same pages
```

Everything to the left of the arrow is deterministic and pure: same input → same HTML string. That makes it snapshot-testable.

## Design spec (what can vary)

```ts
type DesignSpec = {
  templateId: 'clarity' | 'meridian' | 'heritage';
  accent: string;            // hex; contrast-checked against white (≥ 4.5:1 for text use, else auto-darkened)
  fontPair: 'modern' | 'classic' | 'humanist' | 'executive' | 'technical';
  density: 'compact' | 'balanced' | 'airy';
  pageSize: 'A4' | 'Letter';
  options?: { headerAlign?: 'left' | 'center'; skillStyle?: 'tags' | 'inline' };
};
```

The spec is small on purpose. It is the *only* surface AI can touch for visuals, so every combination must be professional. Each template declares which options it supports and their defaults; unsupported values are ignored rather than breaking layout.

### Font pairs (self-hosted, OFL-licensed, embedded in PDF)
| Pair | Headings | Body | Character |
|---|---|---|---|
| modern | Inter Tight | Inter | Neutral, contemporary |
| classic | Source Serif 4 | Source Sans 3 | Traditional, trustworthy |
| humanist | Lora | Lato | Warm, approachable (teaching, healthcare) |
| executive | Cormorant Garamond | Source Sans 3 | Understated luxury |
| technical | IBM Plex Sans | IBM Plex Sans | Precise, engineering |

Fonts are limited to Latin + Latin-extended subsets in MVP; documents containing other scripts fall back to system fonts (documented limitation; Phase 10 adds Noto families).

### Density
A single scale factor feeds type size (9.5 / 10 / 10.5 pt body), line-height, section gap and page margins (14 / 17 / 20 mm). Templates use only these variables, so density always stays proportional.

## Launch templates

| Template | Layout | For | ATS notes |
|---|---|---|---|
| **Clarity** | Single column; name and contact in a clean header; accent rule under section titles | Everyone; default for drivers, retail, trades, office | Linear reading order; perfect parsing |
| **Meridian** | Header band + main column (experience, education) + tinted sidebar (contact, skills, languages, licences) | Teachers, nurses, technical roles, graduates | Sidebar comes after the main column in DOM order (see "Reading order") |
| **Heritage** | Single column, centred serif name, small-caps section titles, generous whitespace | Executives, managers, senior professionals | Linear |

**Reading order:** In two-column templates the DOM order is: header → main column → sidebar. Text extraction and screen readers therefore read the most important content first; visually the sidebar is placed by CSS grid. Contact details are duplicated nowhere — they live in the header for all templates.

## Pagination

CSS fragmentation alone (`break-inside: avoid`) cannot give us predictable two-column pages, repeated sidebar backgrounds, or identical preview pages. We therefore paginate explicitly with a small runtime that runs **inside the document** — in the preview iframe and in Chromium alike.

### Blocks
Templates emit flat lists of blocks per flow (`main`, `aside`). Granularity:
- Section heading — `data-keep="with-next"` (never last on a page).
- Entry head (title, organization, dates) + first two bullets — `data-keep="together"`.
- Each further bullet — its own block (entries may split between bullets, never mid-line).
- Short sections (≤ ~6 lines, e.g. a summary) — one block.

### Algorithm (`planPages`, pure and unit-tested)
1. Wait for `document.fonts.ready`.
2. Measure each block's height in a hidden column of the correct width (`getBoundingClientRect`, blocks use padding not margins so heights are additive).
3. For each flow, fill pages greedily: if a block does not fit, move it to the next page; if it is `with-next`, move it together with its successor; a block taller than a full page is placed alone and clipped is impossible because entries are split at bullets — such a block only occurs with extreme input and is rendered with an overflow warning flag for QA.
4. Page 1 capacity excludes the header height; continuation pages get a slim running header (name · page n) in templates that want it.
5. Page count = max(main pages, aside pages); sidebars render their background on every page.
6. Move the measured nodes into fixed-size page boxes (`210 × 297 mm` or `8.5 × 11 in`), each with `break-after: page`.
7. Set `window.__CV_READY__ = { pages, overflow }` and post a message to the parent window (preview uses it for page count and QA flags).

Because the browser engine, fonts, CSS and algorithm are identical, the PDF has the same pages as the preview. The preview in non-Chromium browsers (Safari/Firefox) can differ by a line in rare cases because of font rasterization differences; the Download page always shows the server-generated page count.

### Orphans and quality rules enforced by the paginator
- No section heading at the bottom of a page.
- No entry head separated from its first bullets.
- A page never begins with a lone bullet if moving one more bullet would fix it (`minBulletsAfterBreak = 1`, cheap backtrack).
- Second-page content less than ~10% of a page raises a QA flag "nearly fits on one page" shown as a tip ("Make spacing compact to fit on one page").

## Fonts and determinism

- Font files ship with the app (`public/fonts`). Preview references them by URL; PDF export inlines them as data URIs so Chromium needs no network.
- No external requests from the document; the iframe is sandboxed (`sandbox="allow-scripts"` with no same-origin) and has a strict CSP.

## Template contract

```ts
type TemplateDefinition = {
  id: TemplateId;
  name: string;            // shown to users
  description: string;     // plain language, used by AI and gallery
  bestFor: PresetId[];
  supports: { sidebar: boolean; headerAlign: ('left'|'center')[]; skillStyle: ('tags'|'inline')[] };
  defaults: Partial<DesignSpec>;
  css: (tokens: DesignTokens) => string;
  Component: (props: { model: RenderModel; design: ResolvedDesign }) => JSX.Element; // pure, no hooks
};
```

Adding a template means adding one folder in `src/modules/templates/library/<id>/` and passing the quality checklist below. No other code changes.

## Quality checklist (every template, every release)

Run against all profession fixtures (`src/modules/resume/fixtures/*`: driver one-pager, nurse, teacher two-pager, graduate, senior engineer three-pager, executive, sparse "name only", extreme-length names/titles, special characters):

1. Renders without overflow flags; no text clipped or overlapping.
2. No orphaned headings or entry heads; breaks are where a typesetter would place them.
3. Preview page count equals PDF page count (automated).
4. Text in the PDF is selectable and extracts in logical reading order (automated with `pdftotext`).
5. Accent colours across the palette keep text ≥ 4.5:1.
6. Looks intentional with missing sections (no empty headings, no orphan dividers).
7. Long names (≥ 40 chars), long job titles and long URLs wrap gracefully.
8. Prints identically on A4 and Letter.
9. Visual snapshot reviewed by a human at 100% zoom (stored under `artifacts/visual/` per release).
