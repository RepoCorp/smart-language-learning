from __future__ import annotations

import json
import logging
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...ai_usage import reserve_ai_usage, settle_ai_usage
from ...models import DailyAIUsage

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_VISUALIZE_IMAGE_PROMPT, STRATEGY_VISUALIZE_PHRASE_PROMPT
from .generation import WORD_EXERCISE_MODEL
from .management import (
    APIView,
    Request,
    Response,
    _call_openai_json_logged,
    _normalized_pair,
    _render_prompt,
    apply_user_scope,
    get_request_user,
    status,
)
from .management_items_listing import _generate_openai_image, _save_exercise_image
from .exercise_persistence import merge_item_exercise_phrases
from .visualize_support import (
    add_visual_memory_cue,
    build_visualize_image_prompt_context,
    merge_visualize_phrase,
)

logger = logging.getLogger(__name__)


def _call_openai_text_logged(
    *,
    label: str,
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 12,
    model: str | None = None,
    temperature: float = 1.0,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
) -> str:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("content.visualize.text.skipped label=%s reason=missing_api_key", label)
        return ""

    model_name = str(model or WORD_EXERCISE_MODEL).strip() or WORD_EXERCISE_MODEL
    logger.info(
        "content.visualize.text.request label=%s model=%s system_prompt=%s user_input=%s",
        label,
        model_name,
        system_prompt,
        user_input,
    )
    body = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        "temperature": temperature,
        "top_p": top_p,
        "presence_penalty": presence_penalty,
    }
    request = UrlRequest(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    reservation = reserve_ai_usage(
        provider="openai",
        category=DailyAIUsage.Category.TEXT,
        units=1,
        model=model_name,
        feature="visualize-prompt",
    )
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        settle_ai_usage(reservation, failed=True)
        logger.warning(
            "content.visualize.text.request_failed label=%s model=%s error=%s",
            label,
            model_name,
            repr(exc),
        )
        return ""
    usage = payload.get("usage") if isinstance(payload, dict) else {}
    usage = usage if isinstance(usage, dict) else {}
    settle_ai_usage(
        reservation,
        input_tokens=int(usage.get("prompt_tokens", 0) or 0),
        output_tokens=int(usage.get("completion_tokens", 0) or 0),
    )
    logger.info(
        "content.visualize.text.raw_response label=%s model=%s payload=%s",
        label,
        model_name,
        json.dumps(payload, ensure_ascii=False),
    )
    try:
        content = str(payload["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError, TypeError):
        logger.warning(
            "content.visualize.text.parse_failed label=%s model=%s payload=%s",
            label,
            model_name,
            json.dumps(payload, ensure_ascii=False),
        )
        return ""
    logger.info(
        "content.visualize.text.content label=%s model=%s content=%s",
        label,
        model_name,
        content,
    )
    return content


class ContentItemVisualizeView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        request_started_at = time.perf_counter()
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        generation_stage = str(request.query_params.get("stage", "full")).strip().lower()
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        source_name = language_display_name(source_language)
        target_name = language_display_name(target_language)
        stored_visualize_entry = item.exercise_phrases.get("visualize_phrase") if isinstance(item.exercise_phrases, dict) else None
        source_text = ""
        target_text = ""

        if generation_stage == "image_only":
            if isinstance(stored_visualize_entry, dict):
                source_text = str(stored_visualize_entry.get("source_text", "")).strip()
                target_text = str(stored_visualize_entry.get("target_text", "")).strip()
            if not source_text or not target_text:
                return Response({"detail": "Failed to generate visualize phrase"}, status=status.HTTP_409_CONFLICT)
        else:
            parsed = _call_openai_json_logged(
                label="content_item_visualize",
                system_prompt=_render_prompt(
                    STRATEGY_VISUALIZE_PHRASE_PROMPT,
                    source_name=source_name,
                    target_name=target_name,
                    source_text=item.spanish_text,
                    target_text=item.german_text,
                    word_type=item.word_type or "",
                    notes=item.notes or "",
                ),
                user_input=(
                    f"Item source text: {item.spanish_text}\n"
                    f"Item target text: {item.german_text}\n"
                    f"Item word type: {item.word_type or ''}\n"
                    f"Item notes: {item.notes or ''}\n"
                ),
                timeout_seconds=12,
                model=WORD_EXERCISE_MODEL,
                temperature=1.0,
                top_p=1.0,
                presence_penalty=0.0,
            )
            if not isinstance(parsed, dict):
                return Response({"detail": "Failed to generate visualize phrase"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            target_text = str(parsed.get("target", "")).strip()
            source_text = str(parsed.get("source", "")).strip()
            if not source_text or not target_text:
                return Response({"detail": "Failed to generate visualize phrase"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            exercise_phrases = merge_item_exercise_phrases(
                item,
                lambda existing_payload: merge_visualize_phrase(
                    exercise_phrases=existing_payload,
                    source_text=source_text,
                    target_text=target_text,
                ),
            )
            if generation_stage == "phrase_only":
                logger.info(
                    "content.visualize.request_finished item_id=%s stage=%s elapsed_ms=%d",
                    item.id,
                    generation_stage,
                    round((time.perf_counter() - request_started_at) * 1000),
                )
                return Response({"exercise_phrases": exercise_phrases})

        image_prompt_context = build_visualize_image_prompt_context(
            target_text=item.german_text,
            target_language=target_language,
            word_type=item.word_type or "",
            notes=item.notes or "",
        )
        image_prompt = _call_openai_text_logged(
            label="content_item_visualize_image_prompt",
            system_prompt=_render_prompt(
                STRATEGY_VISUALIZE_IMAGE_PROMPT,
                source_name=source_name,
                target_name=target_name,
                source_text=item.spanish_text,
                target_text=item.german_text,
                word_type=item.word_type or "",
                sentence=target_text,
                notes=image_prompt_context.notes,
                word_friend_requirement_block=image_prompt_context.word_friend_requirement_block,
                word_friend_guideline_block=image_prompt_context.word_friend_guideline_block,
            ),
            user_input=(
                f"Item source text: {item.spanish_text}\n"
                f"Item target text: {item.german_text}\n"
                f"Sentence: {target_text}\n"
                f"Item word type: {item.word_type or ''}\n"
                f"Item notes: {image_prompt_context.notes}\n"
            ),
            timeout_seconds=12,
            model=WORD_EXERCISE_MODEL,
            temperature=1.0,
            top_p=1.0,
            presence_penalty=0.0,
        )
        if not image_prompt:
            return Response({"detail": "Failed to generate visualize image prompt"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        image_prompt = add_visual_memory_cue(image_prompt, image_prompt_context)

        image_started_at = time.perf_counter()
        image_bytes = _generate_openai_image(image_prompt)
        logger.info(
            "content.visualize.image_generation_finished item_id=%s elapsed_ms=%d bytes=%d",
            item.id,
            round((time.perf_counter() - image_started_at) * 1000),
            len(image_bytes or b""),
        )
        if not image_bytes:
            return Response({"detail": "Failed to generate visualize image"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        save_started_at = time.perf_counter()
        image_url = _save_exercise_image(image_bytes)
        logger.info(
            "content.visualize.image_save_finished item_id=%s elapsed_ms=%d success=%s",
            item.id,
            round((time.perf_counter() - save_started_at) * 1000),
            bool(image_url),
        )
        if not image_url:
            return Response({"detail": "Failed to save visualize image"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: merge_visualize_phrase(
                exercise_phrases=existing_payload,
                source_text=source_text,
                target_text=target_text,
                image_prompt=image_prompt,
                image_url=image_url,
            ),
        )
        logger.info(
            "content.visualize.request_finished item_id=%s stage=%s elapsed_ms=%d",
            item.id,
            generation_stage,
            round((time.perf_counter() - request_started_at) * 1000),
        )
        return Response({"exercise_phrases": exercise_phrases})
