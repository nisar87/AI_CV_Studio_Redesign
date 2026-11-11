# AI CV Studio

An AI-first career document studio: tell us what kind of work you do, answer a few plain-language questions, pick or describe a look, and get a professional CV you can edit and download as a PDF — free, without an account.

- **Status, verification results and the exact next step:** [`docs/STATUS.md`](docs/STATUS.md)
- **Documentation index (product, UX, engineering, roadmap, ADRs):** [`docs/README.md`](docs/README.md)

## Run it locally

Requirements: Node.js 20.9+ and Google Chrome or Chromium (used to create PDFs).

```bash
npm install
npm run dev            # http://localhost:3000
```

If Chrome is not found automatically, set `CHROME_EXECUTABLE_PATH` (see `.env.example`).

### AI help (Google Gemini)

Without a key, development uses a built-in demo provider (answers are labelled "Demo AI"). To use Gemini, create `.env.local` (never commit it):

```bash
GEMINI_API_KEY=your-key        # from Google AI Studio; use a project with billing enabled
# AI_MODEL_FAST=gemini-flash-latest   # optional model ids
# AI_MODEL_SMART=gemini-flash-latest
```

Check the AI's truthfulness on 48 realistic samples: `npm run ai:eval` (log in `artifacts/ai-eval/`). In production, AI is off unless a key is set.

## Quality checks

```bash
npm run verify         # lint, typecheck, format check, unit tests, production build
npm run build && npx playwright install chromium && npm run test:e2e
npm run qa:templates   # every design × sample CV → PDF, checks page counts (needs poppler-utils)
```

## Publishing this repository

This history was prepared offline. To publish every phase branch and tag to GitHub from the bundle:

```bash
git clone ai-cv-studio.bundle ai-cv-studio
cd ai-cv-studio
git remote set-url origin https://github.com/nisar87/AI_CV_Studio_Redesign.git
git push origin --all
git push origin --tags
```

Then enable branch protection on `main` (require the **CI** workflow).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Zod · Chromium (PDF) · Vitest · Playwright. Architecture decisions: [`docs/adr/`](docs/adr/).
