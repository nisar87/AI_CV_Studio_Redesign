# ADR-0001: Web stack — Next.js, React, TypeScript, Tailwind

**Status:** Accepted (Phase 0, November 2026)

## Context
Web-only product; needs SEO-friendly marketing pages, a highly interactive editor, server endpoints for PDF and AI, and long-term maintainability by a small team. Flutter was explicitly ruled out.

## Options considered
1. **Next.js (App Router) + React + TypeScript** — one framework for static pages, client app and API; largest ecosystem; deploys on Vercel or as a Node server.
2. **Vite SPA + separate Node API (Fastify)** — simpler client model, but two deployables, separate routing/SEO handling for marketing pages.
3. **SvelteKit / Remix-style alternatives** — capable, smaller ecosystems for editor-grade components and hiring.

## Decision
Next.js 16 with React 19 and TypeScript (strict). Tailwind CSS v4 mapped onto our own CSS custom-property tokens. Zod for runtime validation shared by client and server. Minimal UI dependencies (lucide icons; Radix only for complex accessible primitives).

## Consequences
+ Single deployable modular monolith; shared types end to end.
+ Static marketing pages and dynamic studio in one app.
− Must keep server/client boundaries disciplined (`'use client'` only in features that need it).
− Framework churn: pin major versions; upgrade deliberately.
