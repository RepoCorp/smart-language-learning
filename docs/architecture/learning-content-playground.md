# Learning content playground

The new learning definitions are being developed alongside the existing app.
The registered `-keit` production evaluation now runs in ordinary sessions;
item views, recognition, and other patterns retain their legacy implementations.

Sign in as an administrator and open Configuration > Administration > Learning
content playground, or visit `/admin/learning-content` directly in the frontend.
The page needs the backend running with the new catalog endpoint.

## What can be tested

- Select a registered definition and inspect its actual item view.
- Change the preview interface and translation languages independently. These
  controls do not change the learner's saved application preferences.
- Use the narrow preview, or open the page on a phone, to check layout.
- Close the item using its shared Close control, then reopen it without reloading
  the catalog or resetting preview languages.
- Open Strategies > Examples to see the full hardcoded example set, with no
  generation or additional API requests.
- Open Testing to preview the production evaluation: base word and translation,
  requested meaning, Reveal answer, then Pass/Fail. Next example cycles through
  all six curated pairs. Closing and reopening starts again from the first pair.
- Expand Definition data to inspect the exact data returned by the backend.
- Reload definitions after backend changes. Restart the backend first if its
  current environment does not reload Python files automatically.

The playground is read-only. It does not enroll items, submit reviews, change
SRS schedules, or call AI providers. The hardcoded Examples strategy and production
evaluation preview are connected; exercises and recognition evaluations remain
inactive. Only the new `-keit` definition is registered initially.

## Adding another definition

Create the definition in the appropriate language/concept folder under
`backend/learning/learning_content/`, then register it in `catalog.py`.
The admin-only GET endpoint `/api/admin/learning-content` serializes these
dataclasses directly; there is no separate production preview-data copy.

Views are registered under `frontend/src/features/learningContent/itemViews/`.
The current payload/view type supports affixes; adding another kind also requires
extending the typed payload and registering its view. Missing views and
translations produce explicit notices rather than substitutions.

Outside this page, only registered session evaluations use the new implementation.
The new affix view shares `components/ItemViewHeader.tsx` and the existing
item-header styles with the word/phrase view. This header wraps supplied content
in `itemView/ItemHeaderCard.tsx` and optionally renders audio outside the card.
Views compose `ItemHeading`, `ItemTitle`, `ItemSubtitle`, and metadata components
from `itemView/ItemMetadata.tsx`. The card does not select sections or interpret
item types, word types, languages, or definitions. A new section is composed by
its view, not added as another conditional property of the shared card.

`itemView/legacy/LegacyItemViewHeader.tsx` preserves the existing word/phrase
header API and its noun-title/type decisions while legacy callers are migrated.
Only `LegacyItemView` (formerly `NewItem`) uses this adapter; definition-based views must not use
it. This isolates the remaining domain branching rather than presenting it as
language-agnostic shared behavior. The affix view composes Type and Notes directly.
Patterns use the learner-facing type "Language pattern" / "Patrón del idioma",
with "Word building" / "Formación de palabras" beneath it for affixes.
Prefix/suffix remains internal matching data, not the type label.
The definition explanation supplies Notes, followed by translated examples.
The item view shows only the first two examples; the Examples strategy shows
the full set from the same definition using the same renderer.
Notes describe how existing words are formed, the starting and resulting word
types, and the meaning contributed by the pattern. They should not imply that
the learner can freely attach an ending to any word.

`components/itemView/ItemViewShell.tsx` owns the shared Close control and slots
for content and actions. Existing word/phrase and pattern views use it too.
Close styling lives beside the shell and remains sticky in scrolling containers;
the existing modal wrappers still own viewport sizing and modal scrolling.
The inline playground preview has its own bounded scroll area.

`ItemActions.tsx` renders supplied action groups without knowing the item type or
language. It preserves tooltips, mobile labels, disabled/highlight states, the
dangerous-action separator, and horizontal-drag click suppression.
`ItemActionToolbar.tsx` remains a small adapter supplying the current word/phrase
actions. The new `ItemView` accepts optional action props; no handler is inferred
from a definition's identifier. Without supplied actions, the Strategies button
opens the strategies declared in the definition. Testing opens the declared
evaluations. Related dialogs, Questions, and Dangerous actions remain disabled
placeholders. `itemViews/DefinitionActivities.tsx` owns the activity modals.

`strategies/registry.ts` maps the new `affix_examples` identifier to the hardcoded
affix example renderer. It is separate from the existing generated word Examples
strategy. Unknown identifiers produce an explicit unavailable message, not a
substitute strategy. The strategy modal uses a native dialog for focus containment,
Escape dismissal, and focus restoration, plus the shared Close control. Changing
definitions closes the modal; opening it never generates content.

`evaluations/registry.ts` maps `affix_production` to the specialized affix
production view. The definition registers it for `source_to_target`; there is no
item-type or language switch in the common controls. `SelfAssessment` owns only
the local Reveal/Pass/Fail/completed sequence, receiving question and answer
content from its caller. The affix view selects the curated pair and advances
the example index. Interface labels use the preview interface language; example
meanings use the selected translation language. Missing translations, examples,
or implementations produce explicit notices, not substitutions. Changing the
translation language resets the attempt; changing the definition closes testing.
The evaluation modal supports Escape, focus restoration, and bounded scrolling.
Playground results remain local preview state only, with no enrollment or SRS writes.

## Session connection

`learning_content/session.py` looks up the definition and direction, then prepares
only the selected example through `learning_content/evaluations.py`. The affix
preparer lives with the affix family. No language or pattern-key condition is
embedded in session rendering. The existing pattern payload adds an optional
`learning_evaluation` with its registered identifier and prepared content.
`SessionEvaluation` dispatches by that identifier. Unknown implementations or
invalid content show an error, never silently substitute a legacy evaluation.
Directions without a new registration intentionally retain the legacy flow.

The selected example uses the existing directional review version modulo the
example count. Both Pass and Fail advance that counter through the unchanged
review API and SRS. Snapshots keep their pinned version, including after scoring,
so reloads show the same example. Duplicate submissions remain idempotent.
`SelfAssessment` waits for save success, disables duplicate scoring, and retains
the revealed answer on failure for retry. Restored completed attempts show the
answer and Next without submitting again. Next advances the session, not the
example locally. Post-review actions and the rule note after reveal are retained.
Existing enrollments work without a migration or re-saving the pattern.

## Verification

- Backend: `docker compose run --rm --no-deps backend pytest tests/learning_content -q`
- Frontend, from `frontend/`: `env NODE_OPTIONS=--no-experimental-webstorage npm test -- --run tests/learningContent`
- Browser, from `frontend/`: `npm run test:e2e -- e2e/learning-content.spec.ts e2e/session-evaluation.spec.ts e2e/evaluation-layout.spec.ts`

Backend tests check real catalog serialization, access control, and read-only
methods. Browser tests use a mocked catalog and cover desktop and small-screen
English/Spanish layouts, including 200% text. They do not call production.
