from __future__ import annotations

import logging

from ...languages import language_display_name
from ...prompts import (
    WORD_METADATA_CONTEXTUAL_PROMPT,
    WORD_METADATA_NORMALIZATION_PROMPT,
    WORD_METADATA_RULE_PROMPTS,
)
from ...text import normalize_text_for_matching
from .core import call_openai_json, normalize_word_type
from .dialog_click_resolution import refine_special_click_resolution

logger = logging.getLogger(__name__)


def basic_word_metadata(
    *,
    source_text: str,
    target_text: str,
    source_language: str,
    target_language: str,
    source_line: str = "",
    target_line: str = "",
    model: str | None = None,
    reasoning_effort: str | None = None,
) -> tuple[str, str, str]:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    target_context = target_line.strip()
    clicked_word = target_text.strip()
    if not clicked_word:
        raise RuntimeError("Word metadata generation returned incomplete data")
    contextual_source, contextual_target, word_type = _parse_contextual_word_metadata(
        _request_contextual_word_metadata(
            source_name=source_name,
            target_name=target_name,
            clicked_word=clicked_word,
            target_context=target_context,
            model=model,
            reasoning_effort=reasoning_effort,
        )
    )
    if word_type in {"helper", "expression"}:
        contextual_source, contextual_target, _note = refine_special_click_resolution(
            clicked_word=clicked_word,
            source_context=source_line.strip(),
            target_context=target_context,
            source_language=source_language,
            target_language=target_language,
            source_text=contextual_source,
            target_text=contextual_target,
            word_type=word_type,
            note="",
        )
    return normalize_word_metadata(
        source_text=contextual_source,
        target_text=contextual_target,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        source_line=source_line,
        target_line=target_line,
        model=model,
        reasoning_effort=reasoning_effort,
    )


def normalize_word_metadata(
    *,
    source_text: str,
    target_text: str,
    word_type: str,
    source_language: str,
    target_language: str,
    source_line: str = "",
    target_line: str = "",
    model: str | None = None,
    reasoning_effort: str | None = None,
) -> tuple[str, str, str]:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    word_type = normalize_word_type(word_type)
    if not source_text.strip() or not target_text.strip() or not word_type:
        raise RuntimeError("Word metadata generation returned incomplete data")
    target_context = target_line.strip()
    parsed = _call_openai_json_logged(
        label=f"normalize_word_metadata_{word_type}",
        system_prompt=_normalization_prompt_for_word_type(
            word_type,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Word type: {word_type}\n"
            f"Selected target text: {target_text}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=8,
        temperature=0.0,
        top_p=1.0,
        model=model,
        reasoning_effort=reasoning_effort,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Word metadata generation failed")

    normalized_source = str(parsed.get("source_text", "")).strip()
    normalized_target = str(parsed.get("target_text", "")).strip()
    if not normalized_source or not normalized_target:
        raise RuntimeError("Word metadata generation returned incomplete data")
    if word_type == "adjective" and _is_over_reduced_adjective(normalized_target, target_text):
        normalized_source = source_text
        normalized_target = target_text
    if word_type == "helper":
        if len(normalized_target.split()) != 1:
            raise RuntimeError("Word metadata generation returned invalid helper data")
        if (
            source_language != target_language
            and normalize_text_for_matching(normalized_source) == normalize_text_for_matching(normalized_target)
        ):
            raise RuntimeError("Word metadata generation returned invalid helper translation")
    return normalized_source[:255], normalized_target[:255], word_type


def _request_contextual_word_metadata(
    *,
    source_name: str,
    target_name: str,
    clicked_word: str,
    target_context: str,
    model: str | None = None,
    reasoning_effort: str | None = None,
) -> dict | None:
    return _call_openai_json_logged(
        label="contextual_word_metadata",
        system_prompt=WORD_METADATA_CONTEXTUAL_PROMPT,
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Clicked target word: {clicked_word}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=8,
        temperature=0.1,
        top_p=0.95,
        model=model,
        reasoning_effort=reasoning_effort,
    )


def _parse_contextual_word_metadata(parsed: dict | None) -> tuple[str, str, str]:
    if not isinstance(parsed, dict):
        raise RuntimeError("Word metadata generation failed")
    contextual_source = str(parsed.get("source_text", "")).strip()
    contextual_target = str(parsed.get("target_text", "")).strip()
    word_type = normalize_word_type(str(parsed.get("word_type", "")))
    if not contextual_source or not contextual_target or not word_type:
        raise RuntimeError("Word metadata generation returned incomplete data")
    return contextual_source, contextual_target, word_type


def _normalization_prompt_for_word_type(word_type: str, *, source_name: str, target_name: str) -> str:
    rules_template = WORD_METADATA_RULE_PROMPTS.get(word_type)
    if not rules_template:
        raise RuntimeError("Word metadata generation returned invalid word type")
    rules = rules_template.replace("{source_name}", source_name).replace("{target_name}", target_name)
    return (
        WORD_METADATA_NORMALIZATION_PROMPT
        .replace("{word_type}", word_type)
        .replace("{rules}", rules)
    )


def _is_over_reduced_adjective(normalized_target: str, original_target: str) -> bool:
    normalized = normalize_text_for_matching(normalized_target)
    original = normalize_text_for_matching(original_target)
    if not normalized or not original or normalized == original:
        return False
    if " " in normalized or " " in original:
        return False
    if not original.startswith(normalized):
        return False
    return len(original) - len(normalized) > 3


def _call_openai_json_logged(
    *,
    label: str,
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
    model: str | None = None,
    reasoning_effort: str | None = None,
) -> dict | None:
    logger.info(
        "content.word_metadata.model.request label=%s system_prompt=%s user_input=%s",
        label,
        system_prompt,
        user_input,
    )
    parsed = call_openai_json(
        system_prompt,
        user_input,
        timeout_seconds=timeout_seconds,
        model=model,
        reasoning_effort=reasoning_effort,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
    )
    logger.info("content.word_metadata.model.response label=%s parsed=%s", label, parsed)
    return parsed
