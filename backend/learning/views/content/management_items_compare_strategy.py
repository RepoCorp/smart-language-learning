from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import STRATEGY_COMPARE_WORDS_PROMPT
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


def _merge_compare_strategy(*, exercise_phrases: dict, comparisons: list[dict]) -> dict:
    payload = dict(exercise_phrases or {})
    payload["compare_strategy"] = [
        {
            "label": f"compare-{index + 1}",
            "target_text": str(comparison.get("target_text", "")).strip()[:140],
            "source_text": str(comparison.get("source_text", "")).strip()[:140],
            "difference_text": str(comparison.get("difference_text", "")).strip()[:400],
            "mistake_text": str(comparison.get("mistake_text", "")).strip()[:400],
            "target_example_text": str(comparison.get("target_example_text", "")).strip()[:400],
            "target_translation_text": str(comparison.get("target_translation_text", "")).strip()[:400],
            "comparison_example_text": str(comparison.get("comparison_example_text", "")).strip()[:400],
            "comparison_translation_text": str(comparison.get("comparison_translation_text", "")).strip()[:400],
        }
        for index, comparison in enumerate(comparisons[:5])
    ]
    return payload


class ContentItemCompareStrategyView(APIView):
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
            label="content_item_compare_strategy",
            system_prompt=_render_prompt(
                STRATEGY_COMPARE_WORDS_PROMPT,
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
            return Response({"detail": "Failed to generate comparisons"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        comparisons_value = parsed.get("comparisons")
        if not isinstance(comparisons_value, list):
            return Response({"detail": "Failed to generate comparisons"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        comparisons: list[dict] = []
        for comparison in comparisons_value[:5]:
            if not isinstance(comparison, dict):
                continue
            target_text = str(comparison.get("target", "")).strip()
            source_text = str(comparison.get("source", "")).strip()
            difference_text = str(comparison.get("difference", "")).strip()
            mistake_text = str(comparison.get("mistake", "")).strip()
            target_example_text = str(comparison.get("target_example", "")).strip()
            target_translation_text = str(comparison.get("target_translation", "")).strip()
            comparison_example_text = str(comparison.get("comparison_example", "")).strip()
            comparison_translation_text = str(comparison.get("comparison_translation", "")).strip()
            if not (
                target_text
                and source_text
                and difference_text
                and mistake_text
                and target_example_text
                and target_translation_text
                and comparison_example_text
                and comparison_translation_text
            ):
                continue
            comparisons.append(
                {
                    "target_text": target_text,
                    "source_text": source_text,
                    "difference_text": difference_text,
                    "mistake_text": mistake_text,
                    "target_example_text": target_example_text,
                    "target_translation_text": target_translation_text,
                    "comparison_example_text": comparison_example_text,
                    "comparison_translation_text": comparison_translation_text,
                }
            )
        if len(comparisons) < 3:
            return Response({"detail": "Failed to generate comparisons"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        exercise_phrases = merge_item_exercise_phrases(
            item,
            lambda existing_payload: _merge_compare_strategy(
                exercise_phrases=existing_payload,
                comparisons=comparisons,
            ),
        )
        return Response({"exercise_phrases": exercise_phrases})
