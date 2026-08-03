from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_PRACTICE_PHRASES_PROMPT
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
from .exercise_persistence import merge_item_exercise_phrases


def _merge_practice_phrases(*, exercise_phrases: dict, phrases: list[dict]) -> dict:
    payload = dict(exercise_phrases or {})
    cleaned_phrases: list[dict] = []
    for index, phrase in enumerate(phrases[:8], start=1):
        if not isinstance(phrase, dict):
            continue
        source_text = str(phrase.get("source_text", "")).strip()
        target_text = str(phrase.get("target_text", "")).strip()
        if not source_text or not target_text:
            continue
        cleaned_phrases.append(
            {
                "label": str(phrase.get("label", "")).strip() or f"practice-{index}",
                "source_text": source_text[:400],
                "target_text": target_text[:400],
            }
        )
    payload["practice_phrases"] = cleaned_phrases
    return payload


class ContentItemPracticeView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
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
        parsed = _call_openai_json_logged(
            label="content_item_practice",
            system_prompt=_render_prompt(
                STRATEGY_PRACTICE_PHRASES_PROMPT,
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
            return Response({"detail": "Failed to generate practice phrases"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        phrases = parsed.get("phrases")
        if not isinstance(phrases, list):
            return Response({"detail": "Failed to generate practice phrases"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_practice_phrases(
                exercise_phrases=existing_payload,
                phrases=phrases,
            ),
        )
        if not exercise_phrases.get("practice_phrases"):
            return Response({"detail": "Failed to generate practice phrases"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"exercise_phrases": exercise_phrases})
