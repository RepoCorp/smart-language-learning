# Saved item audio

A word item's audio contains only its saved target text, including when that
text is an expression. Its example sentence remains separate context; it is not
appended to the speech input. This applies to initial saving, audio regeneration,
and full word regeneration. All three paths use the fixed OpenAI item voice.

The exercise controls when to play the word and an example sentence separately.
Phrase and dialog audio behavior is unchanged by this separation.

After a word test is scored, the example prefers a saved phrase containing the
whole target text (case-insensitive, not a substring of another word). If none
matches, it uses the item's original `example_sentence`. Expressions always use
that original sentence. Translation and phrase audio are reused only from a
matching saved sentence; missing phrase audio must not replay the word as though
it were the sentence. Warm-up selection is separate and unchanged.

Existing audio files are not rewritten automatically. Regenerating an item's
audio replaces its clip; failed regeneration preserves the existing URL.

Regression coverage: `backend/tests/test_word_audio_text.py`.
Post-test selection and playback: `frontend/tests/wordReview/`.
