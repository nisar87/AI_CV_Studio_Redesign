# ADR-0003: AI as narrow structured tasks behind a provider interface

**Status:** Accepted (Phase 0, November 2026)

## Context
The old product used Gemini for broad generation including layouts, which proved unstable. We need reliable, truthful, cheap AI help, and freedom to change providers.

## Decision
- Define AI capabilities as named tasks with versioned prompts and Zod-validated JSON outputs (`src/modules/ai/tasks/*`).
- Call models through an `AiProvider` interface; first adapter **Anthropic Claude** (fast/smart tiers configured by env), plus a deterministic `mock` adapter for tests and keyless development.
- AI never produces markup or code; visual AI output is limited to a validated `DesignSpec`.
- A deterministic server-side truth guard checks outputs for facts absent from input.

## Alternatives
OpenAI or Gemini as the first provider are equally viable technically; Claude chosen for instruction-following on truthfulness constraints and structured output quality. Switching is one adapter.

## Consequences
+ Predictable, testable AI behaviour; cost per task bounded.
− Less "magic" than open-ended generation — deliberately.
