# Learner-facing grammar explanations

Grammar cards help learners notice a pattern, not learn a grammar vocabulary.
Use natural, everyday language in both English and Spanish:

- Give each pattern a practical title, such as "Two verbs together" instead of
  "Modal verb with infinitive".
- Use a few clear sentences when helpful. Simple does not mean maximally short.
- Familiar words such as verb, noun, and adjective are fine. Avoid requiring
  knowledge of verb types, tense names, conjugations, or case terminology.
- Point to the actual words and explain what they do. Keep the explanation
  focused rather than listing every exception or related rule.
- Preserve accuracy: describe the demonstrated pattern without turning it into
  a universal claim. Do not replace technical language with awkward circumlocutions.

These requirements apply to phrase-feature cards, word grammar notes, and the
private guidance for "Ask about this". Rule questions must still explain only
the study phrase, without inventing extra examples.

Feature IDs and precise model detection definitions are separate from learner
copy and remain unchanged. Editing the wording must not invalidate cached
grammar analysis or require new model calls.

## Generated strategy explanations

Model-generated explanations and instructions use the learner's source language
(the language they speak), independently of interface language. This includes
Compare's differences and mistakes, Decode's explanations and reasons, Encounter's
titles and descriptions, and Act's physical-action instructions. Study words,
word parts, and example sentences remain in the target language, with translations
in the source language. Quoting study words inside explanations is allowed.
Static UI grammar explanations remain localized to the interface language.

Prompt improvements apply to future generations. Do not silently translate,
invalidate, or regenerate already saved strategy results; the learner can
explicitly regenerate them.

## Rules in session exercises

When conversation analysis adds a phrase to difficult-item practice, keep the
specific grammar feature keys that caused its selection. Show their existing
localized titles and simple explanations above the session exercise, under
"Pattern you're practising". Multiple reasons for the same phrase are combined
without duplicates. Do not display every feature found in the phrase or invent
a rule for word-level errors without a feature key.

These reasons persist until difficult practice is completed, and participate in
the session's reset-current-results snapshot. They do not change SRS scheduling
or require another AI request. Previously queued items without a recorded reason
remain unlabeled. Ordinary reviews do not display the practice explanation.

Word-building pattern tests show their existing explanation after the answer is
revealed, in either direction, so the explanation does not give away the answer.
