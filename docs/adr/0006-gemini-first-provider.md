# ADR-0006: Google Gemini as the first live AI provider

**Status:** Accepted (Phase 4, November 2026). Amends ADR-0003 (provider choice only).

## Context
ADR-0003 chose Anthropic Claude as the first adapter behind the `AiProvider` interface. The product owner has a Google Gemini API key and no Anthropic key, and wants to launch on Gemini.

## Decision
- The first live adapter is **Gemini** (`src/modules/ai/providers/gemini.ts`), using the REST `models/{model}:generateContent` endpoint with `responseMimeType: application/json` and a JSON Schema generated from each task's Zod output schema.
- Model ids are configuration, not code: `AI_MODEL_FAST` and `AI_MODEL_SMART`. Both default to the auto-updating alias `gemini-flash-latest`, so the app keeps working when Google retires a dated model id. Production should pin dated ids once chosen.
- The key is read only on the server from `GEMINI_API_KEY` and sent in the `x-goog-api-key` header (never in a URL, so it cannot leak into logs).
- Everything else in ADR-0003 stands: narrow tasks, Zod validation with one repair attempt, the deterministic truth guard, mock provider for tests and keyless development. The guard does not trust any provider; it runs identically for all of them.
- An Anthropic adapter remains a later, one-file addition.

## Consequences
+ Uses the key the owner already has; Flash-tier pricing keeps per-task cost low.
+ The JSON-schema response mode makes invalid output rare; Zod still validates.
− The old product's problems with Gemini came from open-ended generation (layouts, whole CVs), not the model itself. This design keeps Gemini to small, checked tasks, but truthfulness must be proven by the live evaluation (roadmap Phase 4, criterion 3) before launch.
− The development workspace cannot reach Google's API, so live behaviour is verified by running `npm run ai:eval` on a machine with the key.

## Launch requirements (from Google's Gemini API terms, checked November 2026)
- **Billing must be enabled** on the Google Cloud project that owns the key. On the unpaid quota Google may use prompts and responses to improve its products, and human reviewers may read them; that contradicts our privacy notice. With billing active, Gemini use counts as a Paid Service: prompts are not used to improve Google's products and are logged for a limited time only to detect misuse.
- Paid Services are required when serving users in the EEA, Switzerland or the UK.
- Google's terms require users of Gemini-powered apps to be 18 or over and the app not to be directed at under-18s. Our "Student or first job" audience can include 16–17-year-olds; the product owner must decide before launch (age notice on AI actions, or AI off for that preset). Recorded as an open launch item in `docs/STATUS.md`.
