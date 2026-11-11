# AI Architecture

## Principles

1. **Narrow tasks, not a general chatbot.** Each AI capability is a named task with its own prompt, input schema, output schema, model tier and limits.
2. **Structured in, structured out.** Inputs are typed objects; outputs are JSON validated with Zod. Free text only appears inside validated fields.
3. **Content ≠ design.** Content tasks produce words. The design task produces a `DesignSpec` (see `template-engine.md`). No task produces markup, CSS, code or layout.
4. **Truth-preserving.** Tasks may rephrase, reorder, condense and choose stronger verbs. They may not add employers, titles, dates, qualifications, certifications, numbers or achievements that are not in the input. When a stronger sentence would need a fact, the model emits a placeholder question instead: `{{?How many deliveries did you complete per day?}}`.
5. **User stays in control.** Every result is a suggestion with Use / Try again / Dismiss. Nothing is written to the document silently. Every applied suggestion is undoable.
6. **Graceful without AI.** Every flow has a non-AI path; AI failure never blocks creating or exporting a CV.

## Tasks (Phase 4 unless noted)

| Task id | Input | Output | Model tier |
|---|---|---|---|
| `intake.interpret` | User's description of what they need | `{ presetId, targetTitle?, design?: DesignSpec, sectionsToInclude[], clarifyingQuestions[] }` | fast |
| `design.interpret` | Style description + current preset | `{ spec: DesignSpec, explanation, alternatives: DesignSpec[2] }` | fast |
| `write.summary` | Confirmed basics, experience, skills, target role | `{ text, needsInput[] }` | smart |
| `write.improveBullets` | One entry (role, org, bullets) + instruction (clearer/shorter/professional) | `{ bullets[], needsInput[] }` | fast |
| `write.fromNotes` | Free notes about a job | `{ bullets[], needsInput[] }` | fast |
| `suggest.skills` | Preset, role, experience text | `{ skills[] }` (user picks) | fast |
| `import.structure` (Phase 5) | Pasted/extracted CV text | `ResumeContent` draft + `uncertain[]` | smart |
| `job.analyze` (Phase 5) | Job ad + CV | Requirements, matches, gaps (evidence-cited) | smart |
| `letter.draft` (Phase 7) | CV + job + tone | Letter paragraphs + `needsInput[]` | smart |

## Provider abstraction

```ts
interface AiProvider {
  id: 'anthropic' | 'openai' | 'google' | 'mock';
  generateObject<T>(req: {
    model: string; system: string; user: string;
    schema: JsonSchema; maxTokens: number; temperature: number; signal?: AbortSignal;
  }): Promise<{ object: unknown; usage: { inputTokens: number; outputTokens: number } }>;
}
```

- **Initial provider: Anthropic Claude** (fast tier: Claude Haiku; smart tier: Claude Sonnet) using tool-based structured output. Chosen for reliable instruction following on the truthfulness constraint and strong structured output. Model names are configuration (`AI_MODEL_FAST`, `AI_MODEL_SMART`), not code.
- A `mock` provider returns deterministic fixtures for tests, local development without keys, and e2e runs.
- Adding OpenAI or Gemini means one adapter file; tasks are provider-agnostic.

## Prompt management

- Prompts live in `src/modules/ai/tasks/<task>/prompt.ts` as versioned functions (`version: 'summary@3'`), reviewed like code.
- System prompt shared rules (truthfulness, placeholder format, tone: plain, professional, no clichés like "results-driven synergy").
- Every response records `taskVersion` + `model` in telemetry so quality regressions are traceable.
- Golden tests: each task has fixtures (driver, nurse, graduate, engineer) checked with the mock provider for schema, and an opt-in live evaluation script that runs real models and applies automated checks (see guards).

## Validation and guards

1. **Schema validation** (Zod). On failure: one repair attempt sending the validation error back; then fail with a friendly error.
2. **Truth guard** (deterministic, server-side): extract numbers, years, capitalized organization-like phrases and credential keywords from the output; any not present in the input are converted to `{{?…}}` placeholders or the suggestion is rejected. False positives are acceptable; invented facts are not.
3. **Length guard:** bullets ≤ 220 chars, summary ≤ 600 chars.
4. **Design guard:** `DesignSpec` validated against the template registry; accent colour contrast-adjusted.
5. **Prompt-injection posture:** user text is wrapped as data in delimited blocks; tasks have no tools with side effects; outputs are data only, so injection can at worst produce a bad suggestion the user can dismiss.

## Errors, limits and cost

| Concern | Approach |
|---|---|
| Provider errors / timeouts | 20 s timeout; one retry with jitter on 429/5xx; then `AI_UNAVAILABLE` error with non-AI fallback in UI |
| Rate limiting (abuse) | Per-IP and per-device token bucket: 30 requests / 10 min, 150 / day (MVP, in-memory + KV later) |
| Cost control | `maxTokens` per task; fast tier by default; input trimmed to relevant sections; daily global budget kill-switch env var |
| Token accounting | Usage logged per task (no content) for cost dashboards |
| Regeneration | "Try again" re-runs with a varied seed instruction; capped at 5 per field per session |

## Privacy

- Only the fields a task needs are sent (e.g., `write.improveBullets` sends one entry, not the whole CV).
- No AI request content is stored server-side by us; logs contain task id, latency, token counts and error codes only.
- Use provider settings/APIs that do not train on submitted data; disclosed in Help/Privacy.
- Users see "Uses AI" on every AI action; a setting to turn AI help off entirely.
