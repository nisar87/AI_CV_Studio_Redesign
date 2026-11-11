# Application Architecture

## Stack (see ADR-0001)

| Concern | Choice | Why (practical advantage) |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19** | One codebase for marketing pages (static, SEO), the interactive editor, and server endpoints (PDF, AI). Large ecosystem; first-class Vercel deploy; also runs as a plain Node server in Docker |
| Language | **TypeScript (strict)** | The resume schema, design spec and AI contracts are shared across client and server with compile-time safety |
| Styling | **Tailwind CSS v4 + CSS custom-property tokens** | Tokens are the design system; Tailwind maps to them so components stay consistent without a heavy component library |
| UI primitives | Hand-built components on native elements; Radix primitives only where accessibility is hard (dialog, popover) | Small dependency surface, full control over look |
| Icons | lucide-react | Consistent, tree-shakeable, MIT |
| Validation | **Zod** | Single source for runtime validation of stored documents, API payloads and AI outputs; JSON Schema derivable for AI structured output |
| Client state | React state + a small editor store with history (no global state library until needed) | Fewer concepts; undo/redo implemented once in the store |
| Persistence (MVP) | Browser storage behind a `DocumentRepository` interface | Works without accounts; swapped/augmented by a server repository in Phase 6 |
| Persistence (Phase 6+) | PostgreSQL (Neon) + Drizzle ORM | Relational, cheap, typed migrations |
| PDF | **Headless Chromium** (`puppeteer-core`; `@sparticuz/chromium` on serverless, system Chrome locally/in Docker) | Prints the *same* HTML the user previews — one render path (see ADR-0002) |
| AI | Provider-agnostic `AiProvider` interface; first adapter: Anthropic Claude | Structured outputs + strong instruction following; swappable (see ADR-0003) |
| Tests | Vitest (unit), Playwright (e2e, visual, PDF checks), axe-core (a11y) | Fast unit loop; real-browser verification of what users see |
| Quality gates | ESLint, Prettier, `tsc --noEmit`, GitHub Actions CI | Every PR proves health before merge |

## Architectural style: modular monolith

One deployable Next.js app. Code is organized by **domain module**, each with a public `index.ts`. Modules may depend only on modules listed below them; the rule is checked in review and by an ESLint import-boundary rule once the module count grows.

```
app/            Routes only: compose modules, no business logic
 ├─ (marketing)  Home, templates, help, legal (static)
 ├─ (studio)     My CVs, guided flow, editor, download (client-heavy)
 └─ api/         Route handlers: /api/pdf, /api/ai/* (thin)
src/
 ├─ features/    UI features: start, guided, editor, design-panel, library, download
 ├─ components/  Design-system components (ui/) and app shell (layout/)
 ├─ modules/
 │   ├─ resume/      Schema (Zod), defaults, presets, pure operations (add/move/remove), migrations
 │   ├─ templates/   Template registry, template components, design spec, fonts, document builder, paginator
 │   ├─ export/      PDF renderer interface + Chromium implementation, filename rules
 │   ├─ ai/          Provider interface, task definitions (prompt + schema), guards, usage limits
 │   └─ storage/     DocumentRepository interface + browser implementation (+ server in Phase 6)
 ├─ lib/         Small generic utilities (ids, dates, debounce)
 └─ styles/      tokens.css, globals.css
```

Dependency direction: `app → features → components/modules → lib`. `modules/templates` depends on `modules/resume` (types) only. `modules/export` depends on `modules/templates`. Nothing depends on `features`.

## Key boundaries

1. **Resume data ↔ design.** A `ResumeDocument` holds content plus a `DesignSpec` value. Templates are pure functions `(content, design) → markup`. Changing template never touches content.
2. **Rendering ↔ exporting.** `modules/templates` produces a complete HTML document string. Preview shows it in a sandboxed iframe; export prints the very same string in Chromium.
3. **AI ↔ everything.** AI tasks return validated data structures (text suggestions, design specs, section plans). They never return markup, CSS or code, and never write to the document without a user action.
4. **Storage ↔ UI.** UI talks to `DocumentRepository`; whether data is in the browser or the database is invisible to features.

## Request flow examples

**Live preview:** editor change → store updates document → `buildDocumentHtml(doc)` (client) → iframe `srcdoc` updated (debounced 150 ms) → in-document paginator lays out pages.

**PDF export:** client POSTs the document JSON to `/api/pdf` → server validates with Zod → `buildDocumentHtml(doc, { fonts: 'inline' })` → Chromium `setContent` → waits for `window.__CV_READY__` (fonts loaded + pagination done) → `page.pdf({ preferCSSPageSize: true })` → streams `application/pdf`.

**AI suggestion (Phase 4):** client POSTs `{ task, input }` to `/api/ai/<task>` → rate-limit check → task builds prompt from versioned template → provider call with JSON schema → Zod validation (one repair retry) → truth guard (no new numbers/organizations) → response with `suggestion` + `needsInput[]`.

## Performance budgets

| Metric | Budget |
|---|---|
| Home LCP (4G mobile) | < 2.0 s |
| Editor JS (gzipped, initial) | < 250 KB |
| Preview update after keystroke | < 200 ms perceived |
| PDF generation (2 pages, warm) | < 2 s p95 |
| AI suggestion | < 6 s p95, streaming where useful |

## Configuration

All runtime configuration through environment variables validated at boot by a Zod schema (`src/lib/env.ts`): `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_SMART`, `CHROME_EXECUTABLE_PATH` (optional), `RATE_LIMIT_*`, later `DATABASE_URL`, `AUTH_SECRET`. Secrets are server-only; nothing secret is prefixed `NEXT_PUBLIC_`.
