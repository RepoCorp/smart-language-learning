from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_RELATED_WORDS_PROMPT
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


def _clean_related_group(entries: object, *, limit: int) -> list[dict]:
    if not isinstance(entries, list):
        return []
    cleaned: list[dict] = []
    for entry in entries[:limit]:
        if not isinstance(entry, dict):
            continue
        target_text = str(entry.get("target_text", "")).strip()
        source_text = str(entry.get("source_text", "")).strip()
        example_target_text = str(entry.get("example_target_text", "")).strip()
        example_source_text = str(entry.get("example_source_text", "")).strip()
        explanation_text = str(entry.get("explanation_text", "")).strip()
        if not (target_text and source_text and example_target_text and example_source_text):
            continue
        cleaned_entry = {
            "target_text": target_text[:255],
            "source_text": source_text[:255],
            "example_target_text": example_target_text[:400],
            "example_source_text": example_source_text[:400],
        }
        if explanation_text:
            cleaned_entry["explanation_text"] = explanation_text[:500]
        cleaned.append(cleaned_entry)
    return cleaned


def _merge_related_groups(*, exercise_phrases: dict, same_family: list[dict]) -> dict:
    payload = dict(exercise_phrases or {})
    payload.pop("connect_groups", None)
    payload["related_groups"] = {"same_family": same_family}
    return payload


class ContentItemRelatedView(APIView):
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
            label="content_item_related",
            system_prompt=_render_prompt(
                STRATEGY_RELATED_WORDS_PROMPT,
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
            return Response({"detail": "Failed to generate related words"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        same_family = _clean_related_group(parsed.get("same_family"), limit=5)
        if not same_family:
            return Response({"detail": "Failed to generate related words"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_related_groups(
                exercise_phrases=existing_payload,
                same_family=same_family,
            ),
        )
        return Response({"exercise_phrases": exercise_phrases})
