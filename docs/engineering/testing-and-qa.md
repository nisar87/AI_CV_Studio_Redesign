# Testing and Quality Assurance

## Test layers

| Layer | Tool | What it covers | Runs |
|---|---|---|---|
| Static | `tsc --noEmit`, ESLint, Prettier check | Types, common bugs, formatting | Every commit (CI) |
| Unit | Vitest | Schema/migrations, resume operations, presets, date formatting, `planPages` pagination algorithm, design-spec resolution and contrast, AI guards, filename rules | Every commit |
| Rendering snapshot | Vitest | `buildDocumentHtml(fixture)` is deterministic; template markup snapshots per fixture | Every commit |
| End-to-end | Playwright (Chromium; WebKit/Firefox smoke) | Real user flows: start → guided → editor → download; reorder; undo; backup/restore | Every PR |
| PDF verification | Playwright + `pdftotext`/`pdfinfo` | Page count equals preview page count; text extracts in reading order; fonts embedded; no overflow flags | Every PR (fixtures) |
| Visual review | Playwright screenshots → `artifacts/visual/<phase>/` | Desktop (1440), tablet (834), phone (390) for each page; every template × key fixtures | Each phase; human-reviewed |
| Accessibility | axe-core in Playwright | No serious/critical violations on every page | Every PR |

## Fixtures (realistic, varied)

`src/modules/resume/fixtures/`:
- `driver` — one page, licences, short bullets.
- `teacher` — two pages, certifications, humanist tone.
- `nurse` — registration, clinical rotations, certifications.
- `graduate` — education first, projects, part-time work, volunteering.
- `engineer` — senior, 6 roles, grouped skills, projects, 3 pages.
- `executive` — long achievements, board roles.
- `sparse` — name and phone only.
- `extreme` — 60-character name, very long titles and URLs, accents and symbols (é, ø, ß, –, “ ”), 12 bullets in one role.

## Definition of done (per feature)

1. Meets acceptance criteria in `../delivery/roadmap.md`.
2. Unit tests for logic; e2e test for the user-visible flow.
3. Lint, types, build, all tests green in CI.
4. Visual check on desktop and phone; screenshots saved.
5. Keyboard-only walkthrough done; axe clean.
6. Loading, empty and error states implemented.
7. Docs updated (this folder) in the same branch.

## Phase verification report

Each phase ends with a short report in `STATUS.md`: what was verified, how (commands), results, screenshots location, known issues with severity.
