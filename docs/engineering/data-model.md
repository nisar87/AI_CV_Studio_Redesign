# Data Model

The canonical schema lives in `src/modules/resume/schema.ts` (Zod). This document explains it; the code is authoritative for exact field names.

## ResumeDocument

```ts
type ResumeDocument = {
  schemaVersion: 1;
  id: string;                 // nanoid
  title: string;              // user-facing name, e.g. "Delivery driver CV"
  presetId: PresetId;         // driver | teacher | healthcare | retail | trades | office | tech | executive | student | general
  locale: string;             // BCP-47, drives date formatting and default page size
  createdAt: string;          // ISO
  updatedAt: string;          // ISO
  parentId?: string;          // Phase 5: tailored version of another document
  basics: Basics;
  sections: Section[];        // ordered as on the page (per flow)
  design: DesignSpec;         // see template-engine.md
};

type Basics = {
  name: string;
  headline: string;           // "Delivery Driver", "Primary School Teacher"
  email: string; phone: string; location: string;
  links: { id: string; label: string; url: string }[];
  summary: string;
  photo: string;              // '' or a small JPEG/PNG/WebP data URL (resized in the browser)
};
```

### Sections (discriminated union on `kind`)

| kind | Item shape | Typical presets |
|---|---|---|
| `experience` | `{ id, role, organization, location, start, end, current, bullets[] }` | all |
| `education` | `{ id, qualification, institution, location, start, end, details[] }` | all |
| `skills` | `{ id, label, keywords[] }` (label optional; one unlabeled group is normal) | all |
| `languages` | `{ id, language, fluency }` | all |
| `certifications` | `{ id, name, issuer, date, detail }` | nurse, teacher, tech |
| `licences` | `{ id, name, issuer, date, detail }` (same shape as certifications) | driver, trades, healthcare |
| `projects` | `{ id, name, role, link, start, end, bullets[] }` | tech, student |
| `volunteering` | same as `experience` | student, general |
| `awards` | same as `certifications` | any |
| `custom` | `{ id, title, subtitle, date, bullets[] }` | any |

Every section: `{ id, kind, title, hidden, items }`. `title` defaults from the preset/locale ("Work history", "Licences") and is user-editable.

Dates are strings: `"YYYY"` or `"YYYY-MM"`, or empty. `current: true` renders "Present". We do not require consistent dates — real lives have gaps.

`design.options.showPhoto` (optional boolean) hides the photo without deleting it.

Placeholders: text fields may contain `{{?question}}` markers produced by AI (Phase 4). Renderers show them highlighted in preview and the Download checklist blocks a "clean" export until they are resolved (the user may still export).

## Presets

`src/modules/resume/presets.ts`: for each preset — display name, example headline, ordered section kinds, default section titles, field hints/examples, suggested skills, default template and accent. Presets are data; adding one requires no code changes elsewhere.

## Persistence

### Phase 3 (no accounts)
- `DocumentRepository` interface: `list()`, `get(id)`, `save(doc)`, `remove(id)`, `exportAll()`, `importAll(json)`.
- `BrowserDocumentRepository`: `localStorage` key `cvstudio:v1:docs:<id>` + index key; documents validated on read; invalid ones quarantined (kept, reported) rather than dropped.
- Typical document size 5–20 KB; storage quota is not a concern at expected volumes.

### Phase 6 (accounts)
PostgreSQL tables (Drizzle):

```
users(id, email, name, created_at, deleted_at)
accounts / sessions / verification_tokens   -- auth library tables
documents(id, user_id → users, title, kind ['cv','letter'], parent_id, data jsonb, schema_version, created_at, updated_at, deleted_at)
document_revisions(id, document_id, data jsonb, created_at)    -- last N per document for recovery
ai_usage(id, user_id?, device_hash, task, input_tokens, output_tokens, created_at)
```

`data` stores the validated `ResumeDocument`; columns duplicate only what is queried. Soft delete with 30-day purge job.

## Migrations

`schemaVersion` increments on breaking changes. `migrate(doc: unknown): ResumeDocument` upgrades step by step and is run on every read (browser and server). Each migration has a fixture test.

## Accounts and cloud documents (Release 1 · R1.1, 2026-11-12)

The server writes all of these with the Admin SDK. Browsers never access Firestore directly, so no client security rules are needed for them.

| Path | Contents |
|---|---|
| `users/{uid}` | `email`, `name`, `lastSeenAt`, `studioV2: true` (merged — fields from the old app are left untouched) |
| `users/{uid}/documents/{id}` | `{ updatedAt, deleted, title, doc: ResumeDocument, serverUpdatedAt }` — `deleted: true` is a tombstone so deletions reach other devices |
| `users/{uid}/documents/{id}/versions/{auto}` | `{ savedAt, doc }`. The last 10 replaced versions are kept |

**Sync rules** (`src/features/account/sync.ts`):

- Editing stays local and instant. While signed in, each save is pushed after about 1.2 s.
- On sign-in, the account and this device are merged:
  - Documents made before sign-in move into the account.
  - The newer edit wins.
  - An older edit that arrives late is never lost: it is saved as "(copy from this device)".
- Signing out removes only this account's documents from the device.

**Sessions:** the Firebase ID token is exchanged for an httpOnly `__session` cookie (14 days, revocation checked). Every API route calls `currentUser()` or `requireUser()`.

**Tests:** e2e runs against the Firebase Auth emulator and the in-memory store (`DATA_STORE=memory`). Production uses Firestore (`DATA_STORE` unset).
