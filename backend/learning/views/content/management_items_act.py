from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_ACT_EXERCISE_PROMPT
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


def _merge_act_exercise(*, exercise_phrases: dict, source_text: str, target_text: str, actions: list[str]) -> dict:
    payload = dict(exercise_phrases or {})
    payload["act_exercise"] = {
        "label": "act",
        "source_text": source_text[:400],
        "target_text": target_text[:400],
        "actions": [action[:240] for action in actions[:5]],
    }
    return payload


class ContentItemActView(APIView):
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
            label="content_item_act",
            system_prompt=_render_prompt(
                STRATEGY_ACT_EXERCISE_PROMPT,
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
            return Response({"detail": "Failed to generate act exercise"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        target_text = str(parsed.get("target", "")).strip()
        source_text = str(parsed.get("source", "")).strip()
        actions_value = parsed.get("actions")
        if not source_text or not target_text or not isinstance(actions_value, list):
            return Response({"detail": "Failed to generate act exercise"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        actions = [
            str(action).strip()
            for action in actions_value
            if str(action).strip()
        ]
        if not actions:
            return Response({"detail": "Failed to generate act exercise"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_act_exercise(
                exercise_phrases=existing_payload,
                source_text=source_text,
                target_text=target_text,
                actions=actions,
            ),
        )
        return Response({"exercise_phrases": exercise_phrases})
