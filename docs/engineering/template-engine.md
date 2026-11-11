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
| humanist ("Warm") | Lora | Nunito Sans | Warm, approachable (teaching, care, first jobs) |
| executive ("Elegant") | Cormorant Garamond | Source Sans 3 | Understated luxury |
| technical ("Precise") | IBM Plex Sans | IBM Plex Sans | Precise, engineering |

Fonts are **static weights**, listed in `src/modules/templates/font-catalog.ts` and copied by `npm run fonts:sync`. Variable fonts were tried first: Chrome embeds them in PDFs as Type 3 glyphs, which some parsers handle poorly; static fonts embed as TrueType (CID) and made PDFs 30–50% smaller. An e2e check fails if any PDF contains a Type 3 font. Every family covers Latin + Latin Extended (verified for characters such as ğ ł ø ß ő Ş); Lato was replaced by Nunito Sans because it lacks Turkish ğ. Other scripts fall back to system fonts (Phase 10 adds Noto families).

### Density
A single scale factor feeds type size (9.5 / 10 / 10.5 pt body), line-height, section gap and page margins (14 / 17 / 20 mm). Templates use only these variables, so density always stays proportional.

## Templates (10)

Each design is built around one signature idea, so the set feels like ten different products rather than one layout in ten colours.

| Template | Picker label | Signature | Photo | Layout | Recommended font |
|---|---|---|---|---|---|
| **Clarity** | Modern & clear | Left accent bar beside a large name; contact icons; hairline section rules | optional (rounded square) | single column | modern |
| **Atelier** | Creative sidebar | Full-height deep colour sidebar with portrait/monogram, contact, skills | optional (circle, ring) | sidebar left | modern |
| **Ledger** | Bold editorial | Oversized name over a heavy rule; numbered section labels in a label column | optional (portrait rectangle) | label column | modern |
| **Meridian** | Bold & organised | Gradient header band with an angled lower edge; tinted side column | optional (circle) | side column right | classic |
| **Chronicle** | Timeline | Dates in a margin column beside a fine line with a marker per role; tinted contact bar | optional (circle, ring) | gutter + single column | classic |
| **Vivid** | Bold & modern | Gradient band with geometric art; portrait overlapping the band edge; pill section labels | optional (large circle) / initials | side column right | modern |
| **Halo** | Warm portrait | Centred portrait in a double ring; ornament rule; calm two columns | optional (circle) / initials | side column left | humanist |
| **Folio** | Editorial | Two-tone stacked name; framed photo with offset colour block; serif titles ending in an accent full stop | optional (portrait rectangle) | side column right | classic |
| **Sprout** | Friendly & fresh | Soft rounded header card with rings; rounded side panel; date chips | optional (circle) / initials | rounded side panel right | humanist |
| **Heritage** | Calm & classic | Monogram letterhead; centred serif name; ruled centred section titles | none (monogram) | single column | executive |

Profession presets choose a sensible default (driver/office → Clarity or Atelier, teacher → Halo, nurse → Meridian, trades → Chronicle, tech → Ledger, retail/student → Sprout, executive → Heritage). Choosing a design in the picker also applies its recommended font; the user can change it afterwards.

### Photos
`basics.photo` holds a ≤ 300 KB JPEG data URL, centre-cropped and resized to 480 px **in the browser** (never uploaded except inside the PDF request). `design.options.showPhoto` hides it without deleting it. Designs declare `photo: 'optional' | 'none'`; some fall back to initials (Atelier, Vivid, Halo, Sprout) so the layout keeps its balance without a photo.

### Engine features used by templates
- `contactsIn: 'aside'` — contact details become the first block of the side column (Atelier, Folio). They are still real text; most parsers find them anywhere.
- `hooks.label` — label-column layouts (Ledger): the label is rendered inside the first block of its section so it takes real space and can never overlap; short lists are grouped into one block.
- `Decor` — optional decorative layer cloned onto every page behind content.
- Every block carries a `k-<kind>` class (timeline styling in Chronicle).
- `ContactList` supports icons and stacked mode; addresses get soft break points after `@ . /` so they never break mid-word.
- Class names in template code are joined with `classes()`, never template literals: the Tailwind Prettier plugin trims spaces inside `className` template strings, which silently glued class names together twice during development. A unit test guards this.

**Reading order:** In two-column templates the DOM order is: header → main column → sidebar. Text extraction and screen readers therefore read the most important content first; visually the sidebar is placed by CSS grid. Contact details are duplicated nowhere — they live in the header for all templates.

## Pagination

CSS fragmentation alone (`break-inside: avoid`) cannot give us predictable two-column pages, repeated sidebar backgrounds, or identical preview pages. We therefore paginate explicitly with a small runtime that runs **inside the document** — in the preview iframe and in Chromium alike.

### Blocks
Templates emit flat lists of blocks per flow (`main`, `aside`). Granularity:
- Section heading — `data-keep="with-next"` (never last on a page).
- Entry head (title, organization, dates) + first two bullets — `data-keep="together"`.
- Each further bullet — its own block (entries may split between bullets, never mid-line).
- Short sections (≤ ~6 lines, e.g. a summary) — one block.

### Implementation notes
- The runtime and `planPages` live in `src/modules/templates/paginate/runtime-source.ts` as **plain JavaScript source text**. An earlier version serialized TypeScript functions with `.toString()`; dev tooling (esbuild `keepNames`) injected helper calls that do not exist inside the document, so the source is now authored as JS. `plan.ts` evaluates the same string for unit tests — the tested algorithm is byte-for-byte the shipped one.
- Templates render with `renderToStaticMarkup` from `react-dom/server.edge` (Next.js forbids the plain `react-dom/server` entry in route handlers); the same builder runs in the browser for the preview and on the server for PDF.
- The preview uses two sandboxed iframes and swaps them when the new document reports `cv:ready`, so edits never flash a blank page.
- Short lists (skills, languages, licences…) of up to four items are kept together; longer lists never strand a single item (`listKeep`).

### Algorithm (`planPages`, pure and unit-tested)
1. Wait for `document.fonts.ready`.
2. Measure each block's height in a hidden column of the correct width (`getBoundingClientRect`, blocks use padding not margins so heights are additive).
3. For each flow, fill pages greedily: if a block does not fit, move it to the next page; if it is `with-next`, move it together with its successor; a block taller than a full page is placed alone and clipped is impossible because entries are split at bullets — such a block only occurs with extreme input and is rendered with an overflow warning flag for QA.
4. Page 1 capacity excludes the header height; continuation pages get a slim running header (name · page n) in templates that want it.
5. Page count = max(main pages, aside pages); sidebars render their background on every page.
6. Move the measured nodes into fixed-size page boxes (`210 × 297 mm` or `8.5 × 11 in`), each with `break-after: page`.
7. Set `window.__CV_READY__ = { pages, overflow }` and post a message to the parent window (preview uses it for page count and QA flags).

Because the browser engine, fonts, CSS and algorithm are identical, the PDF has the same pages as the preview. The preview in non-Chromium browsers (Safari/Firefox) can differ by a line in rare cases because of font rasterization differences; the Download page always shows the server-generated page count.

### Fit pass (avoid near-empty last pages)
After laying out, if the CV has more than one page and the last page is under 30% full, the runtime retries with up to two bounded steps of tighter spacing (`--fit-gap`, `--fit-margin`, `--fit-lh` CSS variables: gaps −20%/−38%, margins −8%/−16%, line height −0.03/−0.06). Font sizes and section order never change. The tighter result is kept only if it removes a page with zero overflow. Preview and PDF run the same pass, so they still match.

### Full-width continuation pages and splitting
Pages after the side column's content switch to full width (`cv-page--wide`); main blocks are measured at both widths. Skill groups longer than 8 items split into chunks of 6 so long lists don't leave earlier side-column space empty.

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
