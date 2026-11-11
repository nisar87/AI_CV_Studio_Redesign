# Git Workflow and Release Discipline

- `main` contains only verified, working code. It is always deployable.
- One branch per phase: `phase-<n>/<slug>` (e.g. `phase-2/template-engine`). Larger phases may use short-lived feature branches merged into the phase branch.
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.

## Per-phase procedure

1. Confirm `main` is green (CI or local `npm run verify`).
2. `git switch -c phase-<n>/<slug> main`.
3. Implement only that phase's scope (see `roadmap.md`).
4. Add tests; run `npm run verify` (lint, typecheck, unit, build) and `npm run test:e2e`.
5. Visual verification; save screenshots under `artifacts/visual/phase-<n>/` (git-ignored; summarized in STATUS).
6. Fix failures and important UX issues.
7. Review against acceptance criteria; update docs and `STATUS.md`.
8. Push branch, open PR, wait for CI.
9. Merge with a merge commit (`--no-ff`) to keep phase boundaries visible.
10. Re-verify `main`; tag `phase-<n>-complete`.

Never: force-push `main`, rewrite published history, bypass required checks, merge red builds. If something blocks a step (permissions, CI unavailable), record it in `STATUS.md` instead of claiming completion.

Incomplete work that must land early goes behind a feature flag (`src/lib/flags.ts`, env-driven) and is off in production.
