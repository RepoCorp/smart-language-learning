# Word-formation patterns

## Current scope

Construction-pattern detection is documented separately in
[Construction patterns](construction-patterns.md). That independently saved feature
does not alter affix enrollment or the exercises described here.

German and English word items can show word-building hints in the Grammar
strategy. The initial German catalog contains exactly `un-`, `-los`, `-bar`, `-lich`, `-heit`, `-keit`,
`-ung`, `-er`, `-in`, and `-chen`. The noun-forming endings `-heit` and
`-keit` have separate IDs, not a combined feature.

The full English catalog contains `un-`, `re-`, `dis-`, `mis-`, `-less`,
`-ful`, `-able/-ible`, `-er`, `-ness`, `-ly`, `-ment`, `-tion/-sion`, `-ist`,
and `-ize/-ise`. Paired spellings are grouped as suggested; the existing
`english_suffix_able` ID now covers both `-able` and `-ible`.
English IDs are distinct from German IDs, including shared spellings like `un-`.

Detection is local and regex-based: `^` anchors prefixes and `$` anchors
suffixes. It ignores case, trims whitespace, normalizes Unicode, and removes a
leading German determiner for nouns. English normalization removes leading
`the`, `a`, or `an` for nouns and `to` for verbs, without changing saved text.
Only a single all-letter word is matched,
and at least two letters must remain outside the affix. Word-type restrictions
reduce false matches (for example, noun `Bar` is not the adjective pattern
`-bar`). Multiple patterns may match the same word, in catalog order.

These are letter-based hints, not a claim that the word's linguistic structure
has been verified. False positives are accepted for this initial version and
the explanations remain qualified rather than asserting a verified analysis.
Cards show the explanation with the affix in bold and a highlighted example,
without a general matching disclaimer or a repeated affix heading. No dictionary, model request, or explicit list
of words is involved. Matching is against the saved word as written, with no
stemming, inflection handling, or recursive search inside compound words.

The regexes and canonical examples live in language-specific files under
`frontend/src/languageFeatures/{german,english}/wordFormation.ts`; the matcher and UI are
language-agnostic. Explanations and canonical-example translations are localized
to the English/Spanish interface, like the existing static grammar content.

## Learning a pattern

The learner explicitly chooses **Practise this pattern** on a matching Grammar
card, or **Save pattern** in the word-saving confirmation. The confirmation
reuses the same local matcher, cards, and enrollment endpoint in dialogs,
saved generated dialogs, and conversation reviews. Saving the word does not
implicitly save its patterns, nor does saving a pattern save the word. A saved
word with an unsaved matching pattern also offers confirmation; once its patterns
are saved, clicking the word opens its details as before. No extra AI request is
needed for affixes. Matching alone never enrolls a pattern. Enrollment is stored per user,
language pair, and pattern key, independently of the word that showed the card.
The same pattern shown on another word is marked as already in the learning deck.

Patterns are `Item` records with type `pattern`, alongside `word` and `phrase`.
They use the same enrollment ownership, first-presentation/seen flow, session
planning, payload loading, review endpoint, and SRS implementation. Each direction
has its own schedule and example counter. Initial dates are staggered using the
same local-day rules as words and phrases. No separate pattern review queue or
progress table remains. Review versions make repeated submissions idempotent.

Migration `0047_patterns_as_items` transfers existing pattern progress to the
production direction, preserving its counts, interval, and due date. Recognition
starts with no successful reviews and its own initial date in the user's timezone.
Unstarted patterns stay unstarted. The old table is removed after the transfer;
the data migration is intentionally irreversible. Browser snapshots with old
pattern-table IDs are discarded and replanned, never interpreted as Item IDs.

The production exercise shows a curated base word in the target language and its
translation, then asks for the derived meaning **only in the source language**.
For example: **hope — esperanza**, then **¿Cómo dirías «sin esperanza»?**.
No affix label or completed answer is visible until Reveal answer. Then the
answer highlights the affix and the learner chooses Pass or Fail, without typing.
The recognition direction shows the complete target word, supplies the base word
and its source-language meaning, and asks what the complete word means. Reveal
shows the source-language answer. This direction also uses Pass/Fail, not typing.
Next advances the normal session. Six distinct curated pairs per pattern (144
across the 24 patterns) rotate with each recorded review in that direction, including failures.
All six are used before the cycle repeats. Examples include both straightforward
formations and real spelling changes, with source-language translations for each
pair. No words are generated by attaching
affixes mechanically, and no AI calls are needed.

Curated practice currently supports German targets with English or Spanish
sources, and English targets with Spanish sources. Unsupported pairs are clearly
marked unavailable; there is no translation fallback. Interface language remains
independent of the exercise's source language.

Patterns participate in the ordinary due/new/upcoming ordering and session size
and duration budgets (30 seconds estimated per pattern). Session snapshots pin
the directional example version, so returning to a completed review keeps its
example. Patterns count in saved totals, new items, ready/future reviews, first-item
celebrations, and daily learning progress. Manage Content has a Patterns section
for viewing examples and deleting enrollments. Saved word/phrase counts remain
distinct, with a separate pattern count.

Only the learning content and exercise display are specialized. Patterns do not
generate audio or invoke word/phrase strategies. A failed pattern follows the
shared SRS failure rule without entering the word/phrase difficult-exercise queue,
whose typing and blocks activities do not apply to a pattern.

Exercise pairs live in `backend/learning/word_formation/`, separated by target
language. New catalog IDs must be added there as well as to the frontend matching
catalog. Grammar detection feature IDs and model catalogs remain unchanged.

The new definition-based `-keit` production evaluation is now connected to this
same session flow. Its examples come from the new `KEIT` definition and include
the article in the revealed answer. It reuses existing enrollment, directional
review counters, snapshot versions, scoring, and SRS; no progress is reset.
Recognition and all other patterns remain on the legacy implementation for now.
See [Learning content playground](../architecture/learning-content-playground.md)
for the registration boundary and the separate, non-persistent preview mode.
