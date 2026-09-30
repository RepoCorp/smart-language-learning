# Saved item audio

A word item's audio contains only its saved target text, including when that
text is an expression. Its example sentence remains separate context; it is not
appended to the speech input. This applies to initial saving, audio regeneration,
and full word regeneration. All three paths use the fixed OpenAI item voice.

The exercise controls when to play the word and an example sentence separately.
Phrase and dialog audio behavior is unchanged by this separation.

Existing audio files are not rewritten automatically. Regenerating an item's
audio replaces its clip; failed regeneration preserves the existing URL.

Regression coverage: `backend/tests/test_word_audio_text.py`.
