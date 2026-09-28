# Typing feedback

Word typing tests and warm-ups play a quiet, short tone on the first confirmed
mistake at each character position. Further mistakes at that position stay silent,
including during the required rewrite. Repeated letters at different positions
are tracked independently. A new item or exercise resets the tracking.

Hints, deletions, and incomplete keyboard composition do not trigger the tone.
The sound does not change scoring or interrupt speech playback. It is generated
locally using Web Audio; unavailable or blocked audio must not prevent typing.

Typing treats a single-character ellipsis (`…`) and three ordinary dots (`...`)
as equivalent. Three dots can be entered one at a time, including during warm-ups
and clean rewrites; keyboard smart punctuation is accepted too. This only changes
the typing representation, not saved content or audio. Missing dots, extra dots,
spelling, accents, and capitalization still follow the existing checks.

Completed word warm-ups show the saved word's translation, even without a linked
example sentence, after either success or failure. When a context sentence is
available, its translation also remains visible. Word-block success feedback
stays green after saving finishes; feedback color reflects the result, not the
request's loading state.
