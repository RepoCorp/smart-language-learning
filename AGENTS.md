# Agent guidance

This repository keeps durable product and engineering context under `docs/`.

Before designing or implementing a change:

1. Read the relevant documents under `docs/product/`, `docs/architecture/`, and `docs/decisions/`.
2. Treat accepted decisions as project constraints unless the current task explicitly changes them.
3. If a requested change conflicts with an existing decision, surface the conflict instead of silently overriding the documented decision.
4. Prefer the simplest solution consistent with the existing codebase and documented decisions.
5. Keep durable project knowledge in the appropriate document rather than expanding this file into a large manual.

## Documentation map

- `docs/product/` — durable product and learning principles.
- `docs/architecture/` — current architectural descriptions and constraints.
- `docs/decisions/` — accepted decisions and their context, including ADR-style records when useful.

Do not treat brainstorming or future ideas as accepted decisions unless they are explicitly marked as such.
