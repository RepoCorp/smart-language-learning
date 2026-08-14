from __future__ import annotations

from ...languages import language_display_name
from ...prompts import (
    TOPIC_CONVERSATION_ANALYZE_USER_TURN_PROMPT,
    TOPIC_CONVERSATION_HELP_PROMPT,
    TOPIC_CONVERSATION_LITERAL_TRANSLATION_PROMPT,
    TOPIC_CONVERSATION_REPLY_PROMPT,
    TOPIC_CONVERSATION_TARGET_PHRASE_HELP_PROMPT,
    TOPIC_CONVERSATION_USER_CORRECTION_PROMPT,
)
from .topic_conversation_goals import evaluate_goal_achievement, generate_topic_conversation_start
from .topic_conversation_model_support import (
    call_openai_json_logged as _call_openai_json_logged,
    recent_history_text as _recent_history_text,
    render_prompt as _render_prompt,
    require_question_model as _require_question_model,
)


def analyze_user_turn(
    *,
    user_text: str,
    assistant_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
    context_label: str,
) -> dict[str, bool]:
    user_clean = str(user_text).strip()
    if not user_clean:
        return {"is_grammatically_correct": False, "makes_sense_in_context": False, "needs_correction": True}
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="analyze_user_turn",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_ANALYZE_USER_TURN_PROMPT,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\n{context_label}"
            f"Recent conversation:\n{_recent_history_text(history, limit=12)}\n"
            f"Learner message ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    required = {"is_grammatically_correct", "makes_sense_in_context", "needs_correction"}
    if not isinstance(parsed, dict) or not required.issubset(parsed):
        raise RuntimeError("Question model request failed")
    return {key: bool(parsed[key]) for key in required}


def literal_translate_user_text(
    *,
    user_text: str,
    source_language: str,
    target_language: str,
) -> str:
    user_clean = str(user_text).strip()
    if not user_clean:
        return ""
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="literal_translate_user_text",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_LITERAL_TRANSLATION_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\n"
            f"Learner text ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    translation = str(parsed.get("translation", "")).strip() if isinstance(parsed, dict) else ""
    if not translation:
        raise RuntimeError("Question model request failed")
    return translation[:1200]


def generate_user_correction(
    *,
    user_text: str,
    assistant_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
    context_label: str,
) -> dict[str, str]:
    user_clean = str(user_text).strip()
    if not user_clean:
        return {key: "" for key in (
            "corrected_user_text", "corrected_user_source_translation", "corrected_user_explanation",
            "natural_alternative_text", "natural_alternative_source_translation",
        )}
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_user_correction",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_USER_CORRECTION_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\n{context_label}"
            f"Recent conversation:\n{_recent_history_text(history, limit=12)}\n"
            f"Learner message ({target_name}): {user_clean}\n"
            f"Assistant reply after the learner message ({target_name}): {str(assistant_text).strip()}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    required = ("corrected_user_text", "corrected_user_source_translation", "corrected_user_explanation")
    if not isinstance(parsed, dict) or any(not str(parsed.get(key, "")).strip() for key in required):
        raise RuntimeError("Question model request failed")
    return {
        "corrected_user_text": str(parsed["corrected_user_text"]).strip()[:1200],
        "corrected_user_source_translation": str(parsed["corrected_user_source_translation"]).strip()[:1200],
        "corrected_user_explanation": str(parsed["corrected_user_explanation"]).strip()[:1200],
        "natural_alternative_text": str(parsed.get("natural_alternative_text", "")).strip()[:1200],
        "natural_alternative_source_translation": str(
            parsed.get("natural_alternative_source_translation", "")
        ).strip()[:1200],
    }


def generate_topic_conversation_reply(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_reply",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_REPLY_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\nConversation topic: {topic}\n"
            f"Temporary notes: {notes}\nLearner role: {role_text}\nRecent conversation:\n"
            f"{_recent_history_text(history, limit=12)}\nLearner new message: {user_text}\n"
        ),
        timeout_seconds=10,
        temperature=0.6,
        top_p=0.9,
        presence_penalty=0.2,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    reply = str(parsed.get("reply_text", "")).strip()
    translation = str(parsed.get("source_translation", "")).strip()
    if not reply or not translation:
        raise RuntimeError("Question model request failed")
    return {"reply_text": reply[:1200], "source_translation": translation[:1200]}


def generate_conversation_help(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_help_request_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> str:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_help",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_HELP_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\n"
            f"Topic: {topic}\nTemporary notes: {notes}\n"
            f"Learner role: {role_text}\nRecent conversation:\n{_recent_history_text(history, limit=10)}\n"
            f"Learner help request ({source_name}): {user_help_request_text}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.15,
        top_p=0.95,
        presence_penalty=0.1,
    )
    help_text = str(parsed.get("help_text", "")).strip() if isinstance(parsed, dict) else ""
    if not help_text:
        raise RuntimeError("Question model request failed")
    return help_text[:1600]


def generate_target_phrase_help(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_help_request_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> tuple[str, str]:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_target_phrase_help",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_TARGET_PHRASE_HELP_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\n"
            f"Topic: {topic}\nTemporary notes: {notes}\n"
            f"Learner role: {role_text}\nRecent conversation:\n{_recent_history_text(history, limit=10)}\n"
            f"Learner request ({source_name}): {user_help_request_text}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.2,
        top_p=0.95,
        presence_penalty=0.1,
    )
    target_text = str(parsed.get("target_text", "")).strip() if isinstance(parsed, dict) else ""
    help_text = str(parsed.get("help_text", "")).strip() if isinstance(parsed, dict) else ""
    if not target_text:
        raise RuntimeError("Question model request failed")
    return target_text[:500], help_text[:600]
