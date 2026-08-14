from __future__ import annotations

from random import choice
from urllib.request import urlopen

from . import generation_conversation as _conversation
from . import generation_words as _words
from .openai_json import call_openai_json as _call_openai_json
from .openai_json import extract_json_from_text

WORD_EXERCISE_MODEL = "gpt-5.6-sol"


def call_openai_json(
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    *,
    model: str | None = None,
    reasoning_effort: str | None = None,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
    json_mode: bool = False,
) -> dict | list | None:
    """Compatibility wrapper so existing generation callers keep one import path."""
    return _call_openai_json(
        system_prompt,
        user_input,
        timeout_seconds,
        model=model,
        reasoning_effort=reasoning_effort,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
        json_mode=json_mode,
        urlopen_fn=urlopen,
    )


def generate_word_exercise_phrases_with_chatgpt(
    spanish_word: str,
    german_word: str,
    notes: str = "",
    word_type: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
    target_contexts: list[str] | None = None,
    model: str | None = None,
    reasoning_effort: str | None = None,
) -> dict:
    effective_model = str(model or WORD_EXERCISE_MODEL).strip() or WORD_EXERCISE_MODEL

    def call_openai_json_with_model(system_prompt: str, user_input: str, timeout_seconds: int = 10, **kwargs) -> dict | None:
        return call_openai_json(
            system_prompt,
            user_input,
            timeout_seconds=timeout_seconds,
            model=effective_model,
            reasoning_effort=reasoning_effort,
            **kwargs,
        )

    return _words.generate_word_exercise_phrases_with_chatgpt(
        spanish_word,
        german_word,
        notes=notes,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        target_contexts=target_contexts,
        call_openai_json_fn=call_openai_json_with_model,
    )


def generate_funny_image_exercise_phrase_with_chatgpt(
    source_word: str,
    target_word: str,
    notes: str = "",
    word_type: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
    target_contexts: list[str] | None = None,
) -> dict:
    return _words.generate_funny_image_exercise_phrase_with_chatgpt(
        source_word,
        target_word,
        notes=notes,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        target_contexts=target_contexts,
        call_openai_json_fn=call_openai_json,
    )


def generate_conversation_with_chatgpt(
    topic: str,
    context: str = "",
    conversation_details: str = "",
    required_words: str = "",
    required_words_language: str = "target",
    dialog_length: str = "standard",
    proficiency_level: str = "A2",
    source_language: str = "spanish",
    target_language: str = "german",
) -> list[dict[str, str]] | None:
    return _conversation.generate_conversation_with_chatgpt(
        topic,
        context=context,
        conversation_details=conversation_details,
        required_words=required_words,
        required_words_language=required_words_language,
        dialog_length=dialog_length,
        proficiency_level=proficiency_level,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json,
        choice_fn=choice,
    )


def generate_keywords_for_phrase_with_chatgpt(
    spanish_phrase: str,
    german_phrase: str,
    source_language: str = "spanish",
    target_language: str = "german",
) -> list[dict[str, str]] | None:
    return _words.generate_keywords_for_phrase_with_chatgpt(
        spanish_phrase,
        german_phrase,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json,
    )


def generate_content_with_chatgpt(
    topic: str,
    context: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> tuple[str, str, str, list[dict[str, str]]] | None:
    conversation = generate_conversation_with_chatgpt(
        topic,
        context=context,
        source_language=source_language,
        target_language=target_language,
    )
    if not conversation:
        return None
    first = conversation[0]
    spanish_text = first["spanish_text"]
    german_text = first["german_text"]
    notes = first.get("notes", "")
    return spanish_text, german_text, notes, []
