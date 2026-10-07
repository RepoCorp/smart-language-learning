# Definition driven learning content

Status: accepted. Recorded 2026-10-07 from the ongoing implementation decisions.

## Purpose

Build a clearer learning-content structure alongside the legacy application,
using existing learning material without inheriting its organization. Work through
one concrete definition and its views, strategies, and evaluations before expanding
the system. The first reference implementation is the German word-building pattern
`-keit`. This is an incremental architecture, not permission to rewrite the app.

The user wants to understand and shape the implementation as it grows. Small files,
meaningful folders, and tests around each boundary matter more than fast bulk
migration. The [learning glossary](../product/learning-glossary.md) defines the
learning concepts without tying them to this implementation.

## Boundaries

- Shared orchestration and presentation must not select behavior with conditions
  such as "if German", "if noun", or "if word". Specialized implementations own
  those rules; definitions and registries select the implementations. Ordinary
  conditions for loading, errors, validation, and interaction remain appropriate.
- Language-specific content belongs in language-specific modules. Pattern-family
  behavior belongs with the family; shared controls must not learn every family.
  Registries are deliberate composition points, not places to hide linguistic logic.
- Item view, strategy, exercise, and evaluation are separate responsibilities.
  A strategy helps explore or understand; an exercise provides practice; an
  evaluation checks recall. Do not collapse exercise and evaluation into one field.
- Definitions describe reusable content and capabilities, not a learner's progress.
  Existing saved Items and review schedules continue to own enrollment and SRS.
  Recognition and production retain independent schedules.
- Reuse presentation through composition: the header, shell, Close control, and
  action toolbar receive content and actions. Do not grow a universal header full
  of type-specific flags. Keep legacy interpretation in explicit adapters.
- Missing translations, registrations, or invalid payloads produce explicit errors
  or unavailable states. Do not invent content or substitute a different strategy.
- Keep definition keys and registered identifiers stable when reorganizing files.
  Existing saved patterns and directional progress must remain usable. A folder
  cleanup is not permission to rename persisted keys, recreate enrollments, or
  reset review schedules.
- Language-independent content should be possible without forcing it into a named
  language. An "other" category is an agreed direction, not an implemented fallback
  language or permission to change the app's supported-language validation today.

## Definition and registration

`LearningDefinition` is the base contract: stable key, language, localized display
text, an item-view identifier, separate strategy and exercise identifiers, and
evaluation identifiers for each direction. Python uses a frozen, keyword-only
dataclass; TypeScript has its corresponding interface. The identifiers select
registered implementations rather than requiring a type switch in the caller.

`AffixPatternDefinition` extends that contract with the letters, their position,
applicable word types, and curated examples. Each example includes a base word,
the resulting word, and translations of both. Keep noun articles in examples and
their meanings where appropriate. These examples are reusable content, not a
separate playground-only copy.

The playground now uses a shared base definition/view contract, with family
validation at registered implementation boundaries. Word and phrase definitions
add study text and translations; words also supply word type and optional gender.
Fixed German examples are registered for checking these new item layouts.
Their activities are not implemented, and ordinary word/phrase items still use
the legacy system. Extend family contracts only when the next concrete use needs it.

The base contract is data, not a large behavior-owning superclass. Add capabilities
through the relevant family and registered implementation; do not put fetching,
rendering, scheduling, and every language's rules into the base definition. The
tuple/Mapping-based Python contract is the current agreed implementation, not an
invitation to redesign it merely to start another family.

## Folder map

Paths below are relative to the repository root. This is the current structure,
not a prescription to add every possible language or pattern family now.

```text
backend/learning/learning_content/
  definition.py                 Base contract
  catalog.py                    Registered definition instances
  evaluations.py                Evaluation preparer registry
  session.py                    Existing session integration
  strategies/                   Shared strategy querying and registration
  patterns/affix/
    definition.py               Affix family contract and examples
    evaluations.py              Family evaluation preparation
    bank_words.py               Family matching rules
    languages/german/keit.py     Concrete language-specific definition
  words/                        Word contract and fixed language examples
  phrases/                      Phrase contract and fixed language examples

frontend/src/features/learningContent/
  definition.ts                 Frontend base contract
  itemViews/                    View registration and activity composition
  strategies/                   Strategy modal, registry, shared bank-word list
  evaluations/                  Shared assessment controls and session dispatch
  patterns/affix/               Family views and evaluation content
  words/                        Word definition, validation, and item view
  phrases/                      Phrase definition, validation, and item view
  locales/                      Interface strings, not message components
  playground/                   Admin preview host
```

Tests are also grouped: `backend/tests/learning_content/` and
`frontend/tests/learningContent/`, with browser flows in `frontend/e2e/`.
The shared item presentation remains in `frontend/src/components/itemView/`
and `ItemViewHeader.tsx`. `LegacyItemView.tsx` is the old item component, formerly
called `NewItem`; it is not limited to newly saved items.

## Playground and migration

The playground renders the real registered definitions and implementations, not
an illustrative mock. It is the place for the user to inspect and refine the new
UI before wider adoption. It is admin-only and read-only: no review writes,
enrollment, or paid generation. "Your words" reads the signed-in user's own bank,
not all users' data, even for an administrator.

The catalog contains `-keit` plus fixed word and phrase definitions. Only `-keit`
has strategies and evaluations; its production and recognition evaluations are
also connected to ordinary sessions through the existing review API. The fixed
word and phrase entries support item-view inspection only. Other patterns and
normal item-detail views remain legacy. The shell can be shared without migrating
those behaviors. See [playground architecture](../architecture/learning-content-playground.md)
for the exact UI, endpoints, session behavior, and verification commands.

For each next slice: agree on the responsibility, characterize affected existing
behavior and run the tests, extract before altering a large file, implement the
bounded change, then rerun relevant tests. Keep the legacy boundary explicit.
Do not migrate more families, activate placeholder actions, or deploy merely
because the new architecture makes that possible.
