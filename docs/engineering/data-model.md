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
