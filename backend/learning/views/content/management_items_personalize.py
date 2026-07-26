from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_PERSONALIZE_TRANSLATION_PROMPT
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


def _merge_personalize_phrase(*, exercise_phrases: dict, source_text: str, target_text: str) -> dict:
    payload = dict(exercise_phrases or {})
    entries = payload.get("personalize_phrases")
    if not isinstance(entries, list):
        entries = []

    normalized_source = source_text.strip()
    normalized_target = target_text.strip()
    merged_entries = [
        entry
        for entry in entries
        if isinstance(entry, dict)
        and str(entry.get("source_text", "")).strip()
        and str(entry.get("target_text", "")).strip()
        and not (
            str(entry.get("source_text", "")).strip() == normalized_source
            and str(entry.get("target_text", "")).strip() == normalized_target
        )
    ]
    merged_entries.append(
        {
            "label": "personalize",
            "source_text": normalized_source,
            "target_text": normalized_target,
        }
    )
    payload["personalize_phrases"] = merged_entries[-30:]
    return payload


class ContentItemPersonalizeView(APIView):
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

        source_text = str(request.data.get("source_text", "")).strip()
        if not source_text:
            return Response({"detail": "source_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(source_text) > 400:
            return Response({"detail": "source_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        source_name = language_display_name(source_language)
        target_name = language_display_name(target_language)
        parsed = _call_openai_json_logged(
            label="content_item_personalize",
            system_prompt=_render_prompt(
                STRATEGY_PERSONALIZE_TRANSLATION_PROMPT,
                source_name=source_name,
                target_name=target_name,
                target_text=item.german_text,
                word_type=item.word_type or "",
                source_text=source_text,
            ),
            user_input=(
                f"Item source text: {item.spanish_text}\n"
                f"Item target text: {item.german_text}\n"
                f"Item word type: {item.word_type or ''}\n"
                f"Student sentence ({source_name}): {source_text}\n"
            ),
            timeout_seconds=12,
            temperature=1.0,
        )
        if not isinstance(parsed, dict):
            return Response({"detail": "Failed to personalize phrase"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        final_source_text = str(parsed.get("source_text", "")).strip() or source_text
        target_text = str(parsed.get("target_text", "")).strip()
        if not target_text:
            return Response({"detail": "Failed to personalize phrase"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = _merge_personalize_phrase(
            exercise_phrases=item.exercise_phrases or {},
            source_text=final_source_text[:400],
            target_text=target_text[:400],
        )
        item.exercise_phrases = exercise_phrases
        item.save(update_fields=["exercise_phrases", "updated_at"])

        return Response(
            {
                "source_text": final_source_text[:400],
                "target_text": target_text[:400],
                "exercise_phrases": exercise_phrases,
            }
        )
