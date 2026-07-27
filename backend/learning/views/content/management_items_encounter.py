from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_ENCOUNTER_SITUATIONS_PROMPT
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


def _merge_encounter_situations(*, exercise_phrases: dict, situations: list[dict]) -> dict:
    payload = dict(exercise_phrases or {})
    payload["encounter_situations"] = [
        {
            "label": f"encounter-{index + 1}",
            "title": str(situation.get("title", "")).strip()[:140],
            "description": str(situation.get("description", "")).strip()[:400],
            "source_text": str(situation.get("source_text", "")).strip()[:400],
            "target_text": str(situation.get("target_text", "")).strip()[:400],
        }
        for index, situation in enumerate(situations[:8])
    ]
    return payload


class ContentItemEncounterView(APIView):
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
            label="content_item_encounter",
            system_prompt=_render_prompt(
                STRATEGY_ENCOUNTER_SITUATIONS_PROMPT,
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
            return Response({"detail": "Failed to generate encounter situations"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        situations_value = parsed.get("situations")
        if not isinstance(situations_value, list):
            return Response({"detail": "Failed to generate encounter situations"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        situations: list[dict] = []
        for situation in situations_value[:8]:
            if not isinstance(situation, dict):
                continue
            title = str(situation.get("title", "")).strip()
            description = str(situation.get("description", "")).strip()
            target_text = str(situation.get("target", "")).strip()
            source_text = str(situation.get("source", "")).strip()
            if not (title and description and target_text and source_text):
                continue
            situations.append(
                {
                    "title": title,
                    "description": description,
                    "target_text": target_text,
                    "source_text": source_text,
                }
            )
        if len(situations) < 5:
            return Response({"detail": "Failed to generate encounter situations"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = _merge_encounter_situations(
            exercise_phrases=item.exercise_phrases or {},
            situations=situations,
        )
        item.exercise_phrases = exercise_phrases
        item.save(update_fields=["exercise_phrases", "updated_at"])
        return Response({"exercise_phrases": exercise_phrases})
