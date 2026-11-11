# ADR-0002: One render path — HTML/CSS documents printed by Chromium

**Status:** Accepted (Phase 0, November 2026)

## Context
The previous product's central failure was divergence between editor canvas, preview and PDF. We need print-quality PDFs, accurate page breaks, and a live preview that matches the PDF exactly.

## Options considered
1. **React-PDF (`@react-pdf/renderer`)** — PDF primitives in React; consistent PDFs, but the live preview is either the PDF itself (slow re-render, no click-to-edit) or a separate HTML approximation (two paths again). Limited CSS (no grid), weaker typography.
2. **HTML/CSS + Chromium print** — one document for preview and export; full CSS; proven by Reactive Resume and JSON Resume tooling. Needs a server Chromium and careful pagination.
3. **Typst / LaTeX server rendering** — excellent typography, but preview requires server round-trips and a separate templating language; harder for designers to iterate.

## Decision
Option 2, with explicit pagination done by a small runtime inside the document so preview and PDF share the same DOM, fonts, CSS and page-splitting algorithm. Templates are pure React components rendered to static markup.

## Consequences
+ What you see is what you send; templates are plain HTML/CSS that any web designer can work on.
+ Text is real, selectable and ATS-parsable.
− Serverless Chromium adds deployment weight (mitigated: `@sparticuz/chromium`, or container service per ADR-0004).
− Non-Chromium browsers may differ by a line in rare cases; Download page reports the authoritative page count from the server.
