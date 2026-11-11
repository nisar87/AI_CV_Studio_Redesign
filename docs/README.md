# AI CV Studio — Documentation

This folder is the single source of truth for what we are building, why, and how. Each file has one job. When two files disagree, the more specific one wins (for example, `template-engine.md` beats `application-architecture.md` on rendering details), and the conflict is a bug to fix.

| Area | File | Answers |
|---|---|---|
| Status | [STATUS.md](STATUS.md) | Where are we right now? What is the exact next action? |
| Product | [product/vision-and-positioning.md](product/vision-and-positioning.md) | Why does this exist, for whom, and how is it different? |
| | [product/old-project-review.md](product/old-project-review.md) | What did the Flutter version try, and what did it teach us? |
| | [product/competitor-research.md](product/competitor-research.md) | What do Canva, Resume.io, Zety, Teal and others do well and badly? |
| | [product/personas-and-journeys.md](product/personas-and-journeys.md) | Who are the users and what are they trying to get done? |
| | [product/feature-inventory-and-mvp.md](product/feature-inventory-and-mvp.md) | Every feature, its priority, and the MVP line |
| UX | [ux/information-architecture.md](ux/information-architecture.md) | Site map, navigation, every page and what is on it |
| | [ux/workflows.md](ux/workflows.md) | Step-by-step flows, including empty/loading/error states |
| | [ux/design-system.md](ux/design-system.md) | Brand, tokens, components, voice, accessibility |
| Engineering | [engineering/application-architecture.md](engineering/application-architecture.md) | Stack, module boundaries, folder layout |
| | [engineering/template-engine.md](engineering/template-engine.md) | How CVs are laid out, paginated, previewed and exported |
| | [engineering/template-authoring-guide.md](engineering/template-authoring-guide.md) | **Read before making a template:** budgets, engine guarantees, coding rules, release checklist, lessons from reviews |
| | [engineering/ai-architecture.md](engineering/ai-architecture.md) | How AI is used, constrained, validated and paid for |
| | [engineering/data-model.md](engineering/data-model.md) | The resume document schema and persistence |
| | [engineering/api-contracts.md](engineering/api-contracts.md) | HTTP endpoints, payloads, errors |
| | [engineering/auth-and-security.md](engineering/auth-and-security.md) | Accounts, privacy, secrets, threat model |
| | [engineering/testing-and-qa.md](engineering/testing-and-qa.md) | Test layers, fixtures, visual QA, definition of done |
| | [engineering/deployment.md](engineering/deployment.md) | Environments, hosting, CI/CD |
| Delivery | [delivery/roadmap.md](delivery/roadmap.md) | Phases, scope, acceptance criteria |
| | [delivery/git-workflow.md](delivery/git-workflow.md) | Branching, PRs, release discipline |
| Decisions | [adr/](adr/) | Architecture decision records (why we chose X over Y) |

## Product principles (non-negotiable)

1. Design quality before feature quantity.
2. Simplicity before complexity.
3. Reliable documents before unlimited AI creativity.
4. Real users before developer convenience.
5. A few excellent templates before many generic ones.
6. Verified releases before rapid merging.
7. Maintainable architecture before premature scale.
8. It must work beautifully for ordinary people — a delivery driver as much as an engineer.
