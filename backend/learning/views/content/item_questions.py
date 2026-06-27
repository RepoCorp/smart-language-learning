from __future__ import annotations

import logging

from django.conf import settings

from ...languages import language_display_name
from ...models import Item, ItemQuestionExchange
from ...prompts import ITEM_QUESTION_DECISION_PROMPT
from ...text import normalize_text_for_matching
from .core import call_openai_json

logger = logging.getLogger(__name__)


def _require_question_model() -> str:
    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", "")).strip()
    if not question_model:
        raise RuntimeError("OPENAI_QUESTION_MODEL is not configured")
    return question_model


def _call_openai_json_logged(
    *,
    label: str,
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    model: str | None = None,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
) -> dict | None:
    logger.info(
        "content.item_questions.model.request label=%s model=%s system_prompt=%s user_input=%s",
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
    )
    logger.info("content.item_questions.model.response label=%s parsed=%s", label, parsed)
    return parsed


def _question_history_pairs(
    *,
    item: Item,
    conversation_history: list[dict] | None,
) -> list[tuple[str, str]]:
    history_rows = list(item.question_exchanges.order_by("created_at", "id"))
    merged_history: list[tuple[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()

    def append_pair(question: str, answer: str) -> None:
        if not question and not answer:
            return
        pair = (question, answer)
        if pair in seen_pairs:
            return
        seen_pairs.add(pair)
        merged_history.append(pair)

    for row in history_rows:
        append_pair(
            str(row.question_text or "").strip(),
            str(row.answer_text or "").strip(),
        )
    for entry in conversation_history or []:
        if not isinstance(entry, dict):
            continue
        append_pair(
            str(entry.get("question_text", "")).strip(),
            str(entry.get("answer_text", "")).strip(),
        )
    return merged_history


def _format_question_history(history_pairs: list[tuple[str, str]]) -> str:
    history_lines: list[str] = []
    for idx, (question, answer) in enumerate(history_pairs, start=1):
        history_lines.append(f"{idx}. Learner: {question}")
        history_lines.append(f"{idx}. Tutor: {answer}")
    return "\n".join(history_lines) if history_lines else "(no previous conversation)"


def _question_model_user_input(
    *,
    item: Item,
    question_text: str,
    source_name: str,
    target_name: str,
    history_text: str,
) -> str:
    return (
        f"Question: {question_text}\n"
        f"Study pair: source={source_name}, target={target_name}\n"
        f"Item being asked about: {item.german_text} ({target_name})"
        f" / {item.spanish_text} ({source_name})\n"
        f"Item source text ({source_name}): {item.spanish_text}\n"
        f"Item target text ({target_name}): {item.german_text}\n"
        f"Item notes: {item.notes}\n"
        f"Item example: {item.example_sentence}\n"
        f"Conversation history (oldest to newest):\n{history_text}\n"
    )


def _call_question_decision_model(
    *,
    item: Item,
    question_text: str,
    source_name: str,
    target_name: str,
    history_text: str,
) -> dict | None:
    question_model = _require_question_model()
    return _call_openai_json_logged(
        label="model_answer_or_reject_item_question",
        system_prompt=ITEM_QUESTION_DECISION_PROMPT.format(
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=_question_model_user_input(
            item=item,
            question_text=question_text,
            source_name=source_name,
            target_name=target_name,
            history_text=history_text,
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )


def _parse_question_decision(parsed: dict | None) -> dict:
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")

    related = bool(parsed.get("related"))
    result_code = str(parsed.get("result_code", "")).strip()
    answer = str(parsed.get("answer", "")).strip()
    reason = str(parsed.get("reason", "")).strip()
    if not result_code:
        raise RuntimeError("Question model request failed")
    if related:
        if not answer:
            raise RuntimeError("Question model request failed")
        return {
            "related": True,
            "code": result_code,
            "answer": answer[:3000],
            "reason": reason,
        }
    return {"related": False, "code": result_code, "answer": "", "reason": reason}


def model_answer_or_reject_item_question(
    *,
    item: Item,
    question_text: str,
    source_language: str,
    target_language: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    normalized_question = normalize_text_for_matching(question_text)
    if not normalized_question:
        return {"related": False, "code": "EMPTY_QUESTION", "answer": ""}

    history_text = _format_question_history(
        _question_history_pairs(item=item, conversation_history=conversation_history)
    )
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_question_decision_model(
        item=item,
        question_text=question_text,
        source_name=source_name,
        target_name=target_name,
        history_text=history_text,
    )
    logger.info(
        "content.item_question.decision item_id=%s model_payload=%r",
        item.id,
        parsed if isinstance(parsed, dict) else None,
    )
    return _parse_question_decision(parsed)


def serialize_question_exchange(exchange: ItemQuestionExchange) -> dict:
    return {
        "id": exchange.id,
        "question_type": exchange.question_type,
        "question_text": exchange.question_text,
        "answer_text": exchange.answer_text,
        "created_at": exchange.created_at.isoformat(),
    }


def item_question_history(item: Item) -> list[dict]:
    rows = list(
        item.question_exchanges.order_by("-created_at", "-id")[:120]
    )
    return [serialize_question_exchange(row) for row in rows]
