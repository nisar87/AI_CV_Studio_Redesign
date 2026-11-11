# API Contracts

All endpoints are Next.js route handlers under `/api`. JSON in/out unless stated. Inputs validated with Zod; invalid input → `400`.

## Error envelope

```json
{ "error": { "code": "INVALID_INPUT", "message": "Human-readable, safe to show", "details": {} } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_INPUT` | 400 | Payload failed validation (`details.issues` = Zod issues) |
| `PAYLOAD_TOO_LARGE` | 413 | Body over limit |
| `RATE_LIMITED` | 429 | Includes `Retry-After` header |
| `AI_UNAVAILABLE` | 503 | Provider failed after retry; client shows non-AI fallback |
| `AI_INVALID_OUTPUT` | 502 | Model output failed validation after repair |
| `RENDER_FAILED` | 500 | PDF rendering failed; client offers Print fallback |
| `INTERNAL` | 500 | Unexpected; logged with request id |

Every response carries `x-request-id`.

## `POST /api/pdf` (Phase 2)

Request body: `{ "document": ResumeDocument }` (max 512 KB).

Response `200`: `application/pdf` stream, headers `Content-Disposition: attachment; filename="<First>-<Last>-CV.pdf"`, `x-page-count: <n>`.

Notes: stateless; document not stored. Timeout 25 s. Concurrency limited per instance (queue of 4).

## `POST /api/ai/:task` (Phase 4)

`task ∈ intake.interpret | design.interpret | write.summary | write.improveBullets | write.fromNotes | suggest.skills`

Request: `{ "input": <task input schema>, "attempt": 1 }` — header `x-device-id` (random id stored in the browser, used for fair-use limits only).

Response `200`:

```json
{ "task": "write.summary", "version": "summary@1", "result": { "text": "…", "needsInput": ["…"] }, "usage": { "remainingToday": 142 } }
```

## `GET /api/health`

`200 { "status": "ok", "version": "<git sha>", "checks": { "chromium": "ok|unavailable", "ai": "configured|mock|missing" } }` — used by uptime checks and the Download page to decide whether to show Print as the primary option.

## Phase 6 additions (sketch; finalized in that phase)

| Method & path | Purpose |
|---|---|
| `GET /api/documents` | List the user's documents (metadata) |
| `GET /api/documents/:id` | Full document |
| `PUT /api/documents/:id` | Upsert with `If-Match: <updatedAt>` for conflict detection (`409 CONFLICT` with server copy) |
| `DELETE /api/documents/:id` | Soft delete |
| `POST /api/documents/import-local` | Bulk import from browser on first sign-in |
| `DELETE /api/account` | Delete account and data |
