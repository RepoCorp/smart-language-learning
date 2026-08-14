from __future__ import annotations

import logging

from django.conf import settings

from .core import call_openai_json

logger = logging.getLogger(__name__)


def recent_history_text(history: list[dict[str, str]], *, limit: int) -> str:
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")
    return "\n".join(history_lines[-limit:])


def render_prompt(template: str, **values: str) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace("{" + key + "}", value)
    return rendered


def require_question_model() -> str:
    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", "")).strip()
    if not question_model:
        raise RuntimeError("OPENAI_QUESTION_MODEL is not configured")
    return question_model


def call_openai_json_logged(
    *,
    label: str,
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    model: str | None = None,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
    json_mode: bool = False,
) -> dict | list | None:
    logger.info(
        "content.topic_conversation.model.request label=%s model=%s system_prompt=%s user_input=%s",
        label,
        model or "",
        system_prompt,
        user_input,
    )
    parsed = call_openai_json(
        system_prompt,
        user_input,
        timeout_seconds=timeout_seconds,
        model=model,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
        json_mode=json_mode,
    )
    logger.info("content.topic_conversation.model.response label=%s parsed=%s", label, parsed)
    return parsed
