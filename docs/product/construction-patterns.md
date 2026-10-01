# Construction patterns

Status: detection, preview, independent saving, and basic session self-checks
implemented, 2026-09-30. More elaborate exercises remain deferred.

## Scope

The German catalog includes:

- future_with_werden
- conditional_with_wuerde
- passive_with_werden
- perfect_with_haben
- perfect_with_sein
- separable_verb

These are reusable constructions, not additional phrase grammar feature IDs.
Affix matching and existing pattern items/review schedules remain unchanged.
There is no migration and no new session item type.

## Clicking a word

The existing contextual word-resolution request receives the closed catalog.
No local linguistic detection or extra classification model call is added.
Only a selected trigger may identify a construction. Clicking the other verb
still resolves that verb as vocabulary. The language-specific definitions in
backend/learning/construction_patterns/german.py include these distinctions.

For the five auxiliary constructions, the confirmation area shows the
construction form, a meaning/explanation in the learner's source language, and
the original sentence. Save pattern persists the preview; Close dismisses it.
The word-save endpoint still rejects treating these constructions as words.

For separable verbs, either separated component should resolve to the complete
lexical verb. The preview additionally explains the pattern, but Add still saves
the word (for example, aufstehen), not the general pattern. A separate Save
pattern action is available, including when the word is already saved.

## Saving and session checks

The authenticated `/api/construction-patterns` endpoint saves an existing Item
of type pattern, scoped to the user, language pair, and catalog key. The preview
is signed, bound to the user, and expires after 24 hours; saving needs no second
model request. Repeated saves reuse the same item and preserve its first example.
No migration is needed. Manage Content lists these items and opens their saved
explanation/example. Saving a pattern never implicitly saves its lexical word.

Saved constructions now participate in the usual new/review/future session pools,
counts, initial presentation, and SRS. Previously saved constructions need no
migration or re-saving. The item payload dispatcher keeps them separate from
affix-specific exercises.

The review asks "Do you know this pattern?" (localized to the interface language).
Recognition shows its target-language form; the other direction shows its saved
source-language explanation. Reveal displays the other side and the saved example,
then the learner chooses Pass or Fail, followed by Next and the usual detail/reset
actions. These are basic self-checks, not generated exercises. Saved explanations
may themselves quote target-language words; they are not a strict cloze test.
Both directions retain independent SRS schedules and idempotent review versions.
Failure does not add patterns to the word/phrase difficult-exercise queue.

Ordinary word confirmations, existing-item opening, and explicit phrase selection
are preserved. Word regeneration does not opt into construction replacement.
The shared confirmation component is used by dialogs (including dialogs opened
from items), saved generated content, and conversation reviews.

## Validation and follow-up

The model returns a catalog key or null and exact evidence from the sentence.
Unknown keys, missing classification, missing explanations, or invalid evidence
fail explicitly. Evidence checking validates the returned data; it does not
attempt to reproduce the linguistic analysis with local rules.

Automated tests mock model outputs. They verify routing, validation, no writes
for previews, independent and idempotent saves, token ownership/expiry, directional
session reviews and resets, preservation of lexical words, and UI behavior. They do not prove that the model correctly distinguishes every
linguistic use. Manual testing should compare auxiliary/lexical uses and tapping
the trigger versus the other verb.

Agree on more elaborate construction exercises separately. Reuse the existing
Item/SRS infrastructure without forcing constructions through affix-specific content.
