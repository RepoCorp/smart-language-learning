from __future__ import annotations

import logging
import re

from ...auth import apply_user_scope
from ...languages import language_display_name
from ...models import DialogTurn, SavedDialog
from ...prompts import DIALOG_CLICK_SPECIAL_REFINEMENT_PROMPT, DIALOG_CLICK_WORD_RESOLUTION_PROMPT
from .core import call_openai_json, normalize_word_type

logger = logging.getLogger(__name__)


def resolve_dialog_click_word_pair(
    *,
    user,
    source_text: str,
    target_text: str,
    source_language: str,
    target_language: str,
    dialog_id_raw,
    turn_index_raw,
    source_line: str = "",
    target_line: str = "",
    clicked_target_token: str = "",
) -> tuple[str, str, str, str]:
    target_context = _target_context_for_click(
        user=user,
        source_language=source_language,
        target_language=target_language,
        dialog_id_raw=dialog_id_raw,
        turn_index_raw=turn_index_raw,
        fallback_target_line=target_line,
    )
    clicked_word = (clicked_target_token or target_text).strip()
    if not clicked_word or not target_context:
        raise RuntimeError("Dialog word resolution missing target context")
    resolved_source, resolved_target, word_type, note = _parse_click_word_resolution(
        _request_click_word_resolution(
            source_language=source_language,
            target_language=target_language,
            clicked_word=clicked_word,
            target_context=target_context,
        )
    )
    resolved_source, resolved_target, note = _refine_click_resolution_if_needed(
        clicked_word=clicked_word,
        source_context=source_line.strip(),
        target_context=target_context,
        source_language=source_language,
        target_language=target_language,
        source_text=resolved_source,
        target_text=resolved_target,
        word_type=word_type,
        note=note,
    )
    return resolved_source, resolved_target, word_type, note


def _request_click_word_resolution(
    *,
    source_language: str,
    target_language: str,
    clicked_word: str,
    target_context: str,
) -> dict | None:
    parsed = _call_openai_json_logged(
        label="resolve_dialog_click_word_metadata",
        system_prompt=DIALOG_CLICK_WORD_RESOLUTION_PROMPT,
        user_input=(
            f"Source language: {language_display_name(source_language)}\n"
            f"Target language: {language_display_name(target_language)}\n"
            f"Clicked target word: {clicked_word}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    return parsed


def _parse_click_word_resolution(parsed: dict | None) -> tuple[str, str, str, str]:
    if not isinstance(parsed, dict):
        raise RuntimeError("Dialog word resolution failed")
    resolved_source = str(parsed.get("source_text", "")).strip()
    resolved_target = str(parsed.get("target_text", "")).strip()
    word_type = normalize_word_type(str(parsed.get("word_type", "")))
    note = str(parsed.get("note", "")).strip()
    if not resolved_source or not resolved_target or not word_type:
        raise RuntimeError("Dialog word resolution returned incomplete data")
    return resolved_source, resolved_target, word_type, note


def _refine_click_resolution_if_needed(
    *,
    clicked_word: str,
    source_context: str,
    target_context: str,
    source_language: str,
    target_language: str,
    source_text: str,
    target_text: str,
    word_type: str,
    note: str,
) -> tuple[str, str, str]:
    if word_type not in {"helper", "expression"}:
        return source_text, target_text, note
    return refine_special_click_resolution(
        clicked_word=clicked_word,
        source_context=source_context,
        target_context=target_context,
        source_language=source_language,
        target_language=target_language,
        source_text=source_text,
        target_text=target_text,
        word_type=word_type,
        note=note,
    )


def refine_special_click_resolution(
    *,
    clicked_word: str,
    source_context: str,
    target_context: str,
    source_language: str,
    target_language: str,
    source_text: str,
    target_text: str,
    word_type: str,
    note: str,
) -> tuple[str, str, str]:
    parsed = _call_openai_json_logged(
        label=f"refine_{word_type}_click_resolution",
        system_prompt=DIALOG_CLICK_SPECIAL_REFINEMENT_PROMPT.replace("{word_type}", word_type),
        user_input=(
            f"Source language: {language_display_name(source_language)}\n"
            f"Target language: {language_display_name(target_language)}\n"
            f"Clicked target word: {clicked_word}\n"
            f"Current source_text: {source_text}\n"
            f"Current target_text: {target_text}\n"
            f"Current note: {note or '(empty)'}\n"
            f"Source-language line context: {source_context or 'not provided'}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        return source_text, target_text, note
    refined_source = str(parsed.get("source_text", "")).strip() or source_text
    refined_target = str(parsed.get("target_text", "")).strip() or target_text
    refined_note = str(parsed.get("note", "")).strip() or note
    if word_type == "expression" and len(refined_target.split()) == 1 and len(target_context.split()) > 1:
        return source_text, target_text, note
    return refined_source, refined_target, refined_note


def line_tokens(value: str) -> list[str]:
    return [match.group(0) for match in re.finditer(r"[^\W\d_]+(?:[-'][^\W\d_]+)*", value, flags=re.UNICODE)]


def normalize_word_token(value: str) -> str:
    return clean_edge_punctuation(value).lower()


def clean_edge_punctuation(value: str) -> str:
    return re.sub(r"^[^\wÀ-ÖØ-öø-ÿ]+|[^\wÀ-ÖØ-öø-ÿ]+$", "", value or "", flags=re.UNICODE).strip()


def _target_context_for_click(
    *,
    user,
    source_language: str,
    target_language: str,
    dialog_id_raw,
    turn_index_raw,
    fallback_target_line: str,
) -> str:
    target_context = ""
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        dialog_id = None
        turn_index = None
    if dialog_id is not None and turn_index is not None:
        dialog = apply_user_scope(SavedDialog.objects, user).filter(
            id=dialog_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
        if not dialog or not turn:
            raise RuntimeError("Dialog word resolution missing dialog turn")
        target_context = str(turn.target_text or "").strip()
    return target_context or fallback_target_line.strip()


def _call_openai_json_logged(
    *,
    label: str,
    system_prompt: str,
    user_input: str,
    timeout_seconds: int,
    temperature: float,
    top_p: float,
    presence_penalty: float = 0.0,
) -> dict | None:
    logger.info(
        "content.dialog_click_resolution.model.request label=%s system_prompt=%s user_input=%s",
        label,
        system_prompt,
        user_input,
    )
    parsed = call_openai_json(
        system_prompt,
        user_input,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
    )
    logger.info("content.dialog_click_resolution.model.response label=%s parsed=%s", label, parsed)
    return parsed
