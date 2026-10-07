# Regression map and debugging pitfalls

Verified against repository files on 2026-09-29. These are starting points, not
proof of exhaustive coverage. Read the actual assertions and add missing cases
before changing the corresponding behavior.

## Focused test entry points

| Area | Existing tests to inspect |
| --- | --- |
| Session lifecycle, directional tests, reveal/grade/audio, difficult practice | `frontend/tests/SessionPage.test.tsx`; `backend/tests/test_session_api.py`, `test_review_api.py`, `test_session_item_boundaries.py` |
| Typing completion, Unicode, hints, feedback | `frontend/tests/wordExerciseCompletion.test.tsx`, `wordTypingEllipsis.test.tsx`, `wordChallengeInputLogic.test.ts`, `typingMistakeSound.test.tsx` |
| Touch/desktop blocks | `frontend/tests/blockDrag.test.ts`, `blockExercises.test.tsx`, `ProgressivePhraseBlocksReview.test.ts` |
| Forms preparation, selection, plural loop, item switching | `frontend/tests/LegacyItemViewForms.test.tsx` |
| Dialog audio mode, speed, cancellation | `frontend/tests/DialogsPageAudio.test.tsx`, `dialogPlayback.test.tsx`; `backend/tests/test_dialog_clear_audio.py`, `test_word_audio_text.py` |
| Conversation closing and goals | `frontend/tests/conversation/`; `backend/tests/test_realtime_closing_instructions.py`, `test_conversation_goal_phase.py` |
| Saving content and grammar persistence | `backend/tests/test_content_api.py`, `test_item_question_grammar.py`, `test_conversation_error_analysis.py` |
| Daily boundaries and streaks | `backend/tests/test_timezone_preference.py`, `test_progress_api.py`, `test_overview_stats_api.py` |
| Localization and language boundaries | `frontend/tests/localization.test.tsx`, `languageFeatures.test.tsx`, `languageTerminology.test.tsx`, `grammarWording.test.tsx` |
| Guides and positioning | `frontend/tests/GuidedTourPosition.test.tsx`, `GuideTopicSelection.test.tsx` |

Test location does not imply that every flow has an integration test. In particular,
check coverage for all four word/phrase and recognition/production combinations,
not just the one that prompted a fix. Historical direction names such as
`es_to_de` can occur in APIs/tests; inspect their meaning before renaming or
assuming they constrain the application to that language pair.

## Persistence is more than visible state

When checking saved strategies, grammar, questions, or audio, trace the request,
database write, read/serialization, and client hydration. Verify reopening and
refreshing, not just the immediate response. A generated result appearing on screen
does not prove it will persist. A missing result does not justify silently generating
another paid copy. Distinguish content from the user's enrollment/progress before
changing deletion or reuse behavior.

## Prompt changes and runtime changes

`backend/learning/prompts.py` reads prompt files into module-level constants at
import time. Editing those text files alone may not reload a running worker;
restart the relevant backend process when needed. Production also needs the new
files deployed. Restarting does not rewrite already saved results.

Before saying a prompt is ignored, identify the actual request path, selected
language-specific prompt, deployed version, and whether the user is looking at a
cached result. Compare the effective request in safe logs. Do not blindly keep
strengthening a prompt without confirming that it is the one being used.

Local `backend/entrypoint.sh` runs migrations and seeding before the development
server. Starting services is not necessarily a read-only diagnostic. Inspect
environment/database targets before operational commands. Do not infer production
credentials or permissions from the local AWS CLI identity; the runtime can use
a different principal.

## Audio and layout need environment-specific checks

Previous user reports distinguished Safari from Chrome and desktop from mobile.
Provider generation, HTML audio playback, browser speech synthesis, and Realtime
audio are separate paths. Identify the path before changing timing or speed.
Preserve full speech; do not stop it using a guessed duration.

Mocked tests cannot establish pronunciation, lyric presence, musical loop quality,
real playback ordering, or finger ergonomics. Supplement relevant tests with a
clearly scoped manual check; report when it has not been done. Screenshots alone
cannot verify dragging, scrolling, playback, or persistence.
