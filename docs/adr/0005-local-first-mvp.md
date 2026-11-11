# ADR-0005: Local-first MVP without accounts

**Status:** Accepted (Phase 0, November 2026)

## Context
Our users include people with limited computer experience who abandon at sign-up walls. CV data is personal.

## Decision
MVP stores documents in the browser behind a `DocumentRepository` interface, with JSON backup/restore. Accounts and cloud sync arrive in Phase 6 as an optional upgrade that imports local documents.

## Consequences
+ Start in seconds; minimal personal data on our servers; simpler security for MVP.
− Data tied to one browser until Phase 6 — mitigated by visible backup prompts and clear copy ("saved on this device").
