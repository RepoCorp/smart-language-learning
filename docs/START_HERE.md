# Start here

This is the compact entry point for continuing WeLearnSmart work in a new chat.
It preserves accepted context, not every historical message. Later explicit user
decisions supersede these notes; verify implementation details against current code.

## Read first

1. [Product philosophy](product/philosophy.md).
2. [Working agreements](decisions/engineering-working-agreements.md).
3. [Dated handoff](handoff.md), checking `git status` before editing.

Then read only the documents relevant to the requested change. Do not reload the
entire conversation history or audit the whole application for a small task.

## Continuing the new learning structure

For work on definitions, patterns, item views, strategies, evaluations, or the
playground, read the accepted [definition-driven architecture decision](decisions/definition-driven-learning-content.md)
and [playground implementation guide](architecture/learning-content-playground.md).
They describe the small-file, registry-based design, the folder map, and what is
still legacy. The playground is a real preview, not a replacement for the whole
app; only explicitly connected evaluations currently run in ordinary sessions.

## Where to find context

| Area | Starting point |
| --- | --- |
| Learning terminology | [Learning glossary](product/learning-glossary.md): items, pattern groups, strategies, exercises, and evaluations |
| Session items and patterns | [Word-formation patterns](product/word-formation-patterns.md); `backend/learning/srs.py`, `review_schedule.py`, `review_availability.py`; `frontend/src/features/session/` |
| Contextual construction patterns | [Construction patterns](product/construction-patterns.md) |
| New learning definitions and playground | [Architecture decision and folder map](decisions/definition-driven-learning-content.md); [playground](architecture/learning-content-playground.md) |
| Blocks and typing | [Block exercises](product/block-exercises.md), [Typing feedback](product/typing-feedback.md) |
| Grammar and languages | [Grammar explanations](product/grammar-explanations.md), [Localization](architecture/localization.md), [English entries](product/english-word-entries.md), [Learning levels](product/learning-levels.md) |
| Onboarding | [Starter guide](product/starter-guide.md) |
| Audio | [Dialog audio](architecture/dialog-audio.md), [Item audio](architecture/item-audio.md) |
| Larger text and mobile zoom | [Text and modal accessibility](architecture/accessibility-text-and-modals.md) |
| Conversation closing | [Conversation ending](architecture/conversation-ending.md) |
| Conversation setup and controls | [Conversation controls](architecture/conversation-controls.md) |
| Admin study time | [Admin study usage](architecture/admin-study-usage.md) |
| Regression tests and recurring pitfalls | [Regression map](architecture/regression-map.md) |
| Cost planning, paused | [AI cost optimization](decisions/ai-cost-optimization-plan.md) |
| Deployment | `low-cost-deploy/README.md`; older option in `aws-deploy/README.md` |

## Technical orientation

- React 18, TypeScript, Vite frontend; Django/DRF backend; PostgreSQL application database.
- Frontend features are grouped under `frontend/src/features/`. Shared components
  and older large modules still exist: inspect rather than assuming refactoring is complete.
- Language-specific behavior belongs under the appropriate language modules and
  prompt folders. Shared UI and orchestration should be language-agnostic.
- Backend prompts live under `backend/learning/prompts/`; do not silently restore
  an older prompt or remove a constraint added to fix a real quality problem.
- Production migration adopted Amplify Hosting with S3 deployment storage and a
  Lightsail backend. RDS is shared with other applications and must not be changed
  casually. Preserve the earlier deployment option's documentation.
- Runtime environment values and deployment state must be checked when relevant.
  Never assume a local result proves production is healthy. Never put credentials
  in handoff documents or logs.

## Commands

Run frontend commands from `frontend/`:

```sh
env NODE_OPTIONS=--no-experimental-webstorage npm test -- --run
env NODE_OPTIONS=--no-experimental-webstorage npm test -- --run tests/conversation
npm run typecheck
npm run build
npm run test:e2e
```

The NODE_OPTIONS override avoids the local Node experimental-webstorage issue
encountered in this workspace. Playwright currently runs Chromium, starts Vite on
127.0.0.1:5174, and is configured in `frontend/playwright.config.ts`. Read each
test's mocking/setup before treating it as backend or production coverage.

Run backend commands from the repository root:

```sh
docker compose run --rm backend pytest
docker compose run --rm --no-deps backend pytest tests/test_realtime_closing_instructions.py tests/test_conversation_goal_phase.py -q
git diff --check
```

The second command is the recently used focused test run, not the full suite.
Use test infrastructure, never a production database or paid generation to run
automated tests. Respect tool permissions. Check services/ports before starting
containers; other projects may already occupy port 8000.

Keep the handoff current after significant work. Store durable decisions in
their topic documents, not in an ever-growing handoff or AGENTS.md.
