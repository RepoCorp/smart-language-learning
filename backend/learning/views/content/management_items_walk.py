from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_WALK_SENTENCES_PROMPT
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


def _merge_walk_sentences(*, exercise_phrases: dict, sentences: list[dict[str, str]]) -> dict:
    payload = dict(exercise_phrases or {})
    payload["walk_sentences"] = [
        {
            "label": f"walk-{index + 1}",
            "source_text": sentence["source_text"][:400],
            "target_text": sentence["target_text"][:400],
        }
        for index, sentence in enumerate(sentences[:5])
    ]
    return payload


class ContentItemWalkView(APIView):
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
            label="content_item_walk",
            system_prompt=_render_prompt(
                STRATEGY_WALK_SENTENCES_PROMPT,
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
            return Response({"detail": "Failed to generate walk exercise"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        sentences_value = parsed.get("sentences")
        if not isinstance(sentences_value, list):
            return Response({"detail": "Failed to generate walk exercise"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        sentences: list[dict[str, str]] = []
        for sentence in sentences_value[:5]:
            if not isinstance(sentence, dict):
                continue
            target_text = str(sentence.get("target", "")).strip()
            source_text = str(sentence.get("source", "")).strip()
            if not target_text or not source_text:
                continue
            sentences.append({"target_text": target_text, "source_text": source_text})
        if len(sentences) != 5:
            return Response({"detail": "Failed to generate walk exercise"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = _merge_walk_sentences(
            exercise_phrases=item.exercise_phrases or {},
            sentences=sentences,
        )
        item.exercise_phrases = exercise_phrases
        item.save(update_fields=["exercise_phrases", "updated_at"])
        return Response({"exercise_phrases": exercise_phrases})
