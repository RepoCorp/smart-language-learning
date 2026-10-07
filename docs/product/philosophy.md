# WeLearnSmart product philosophy

Consolidated from accepted user instructions through 2026-09-29. These are product
constraints, not a claim that every historical edge case is already implemented.

## Learning through personally useful content

Learners create dialogs about situations and interests that matter to them, then
save unfamiliar words and useful phrases into their learning bank. Sessions are
the main place to do the learning work, not just a test of material learned elsewhere.
Conversation practice provides a patient, nonjudgmental partner for using the language.

Help the brain discover patterns through examples, recall, repetition, and varied
practice rather than requiring memorization of grammar terminology. Grammar is
optional, practical support: "Just a tiny bit. We don't like studying grammar either."
Simple explanations must still be accurate and natural, not awkward substitutes
for technical terms. See the dedicated grammar wording document.

Notes in word and phrase item views are optional. Include them only when they
add useful information about meaning or usage that applies beyond the source
dialog or situation. Do not fill the section with a paraphrase of the translation,
obvious information already displayed, or commentary tied to that one context.
When there is no relevant note, omit the Notes section entirely.
Enforce this when generating content: model prompts must request an empty note
by default and apply the relevance rule before supplying one. Context selects
the intended meaning; it does not justify retelling the source situation in notes.
Do not append generic boilerplate after the model has chosen an empty note.

Prefer natural, accessible explanations to technical shorthand. A slightly longer
explanation with a clear example is better than a cryptic rule or an awkward
replacement for a grammar term. Do not imply that a word-building pattern can be
attached freely to any word. Explain what relationship it contributes to existing
words, including meaning, rather than merely naming the pattern.

Personalization is fundamental, not decoration. The first guide introduces language
settings, a personally useful topic, dialog creation, saving words and phrases,
and sessions. Later tutorials expose more features gradually. The interface must
remain usable without understanding every feature at once.

## Sessions and progress

- Words, phrases, and enrolled word-building patterns use the shared item/session
  machinery where possible. Recognition and production have separate SRS schedules.
  Review counts can therefore exceed the number of saved items.
- Daily availability uses the learner's selected timezone and local calendar day,
  not a surprise midday release based only on an item's exact due time.
- Stats and daily pools concern the active study language pair. A streak can be
  maintained by meeting the requirement in any one study language, not necessarily all.
- The accepted streak goal is 30 minutes across one or more sessions, or completing
  the day's pool with at least five learning items. One token item is not enough.
  Preserve the existing pause/buffer design; do not invent new life/skip limits.
- Difficult-item practice is different from an SRS review. Adding a practice item
  after conversation error analysis must not silently count as a test or reschedule
  it as though the learner had failed a review.
- Keep first-presentation, reveal, evaluation, audio, Next, and details behavior
  explicit and tested for each word/phrase and direction combination. Do not infer
  that one flow should behave like another.
- Preserve the global session-expiry alert with extend/end choices without tearing
  down an open item or losing the session. Provide a recovery path for invalid items.

## Content and model quality

- Save and reuse generated strategy content and audio. Generation should be
  intentional, not triggered accidentally by opening a default strategy.
  Grammar detection has its own documented lazy-generation/cache invalidation rules.
- Never silently substitute a provider, invent a successful result, or save incomplete
  output when generation fails. Distinguish quota exhaustion from a generic failure.
- Explanations generated for the learner use the language they speak. Study content
  uses the language being learned; interface localization is a separate setting.
- Preserve the actual intended meaning, selected expression, and grammatical form.
  Saving a subphrase must not reuse the whole sentence's audio as its own.
- Dialogs should depict a diverse world without defaulting every person to masculine.
- In conversation, the partner is not a teacher constantly correcting the learner.
  Review and optional error explanations come separately; show correct examples,
  not repetitions of incorrect forms. Preserve the learner's intended meaning.
- A conversation goal is a general guide, not an assessment. Do not check or
  announce achievement, or prolong/end a conversation based on completing it.
  Encourage use of the learning language while allowing brief help in the
  learner's native language. Accept natural goodbyes independently of the goal.
- Music and repetition audio have carefully tested timing and playback behavior.
  Avoid broad prompt/timing changes, estimated cutoffs, or accidental regeneration.
  Music quality needs listening tests; mocked API success is not proof of usable audio.

## UI principles

Mobile usability is essential, including dragging, sticky controls, readable text,
and overlays that do not hide the action the learner needs. Prefer small, clear
controls, progressive disclosure, and consistent spacing over repeated instructions.

Localize visible labels, confirmations, dropdowns, errors, and accessible names in
English and Spanish. Say "the language you speak" and "the language you're learning"
rather than source/target in learner-facing UI. See localization documentation for
the distinction between static interface copy and generated explanations.

Dangerous actions use a confirmation, not double-clicking. Ordinary Fail remains
a single click. Admin/debug controls are admin-only; access must not rely only on
hiding a button. Do not assume deleting a learner's enrollment may delete shared
content belonging to another learner.

Gender colors are memory aids closely tied to the noun, including its article:
bluish masculine, pinkish feminine, yellowish neuter where applicable. Selection
state must remain distinguishable from gender color. Keep language rules separate.
