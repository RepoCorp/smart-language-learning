from __future__ import annotations

from ...languages import language_display_name
from ...models import Item
from ...prompts import COMPARE_WORDS_INSIGHTS_PROMPT
from .management import (
    APIView,
    Request,
    Response,
    _call_openai_json_logged,
    _normalized_pair,
    _render_prompt,
    _require_question_model,
    apply_user_scope,
    get_request_user,
    status,
)


def _generate_compare_word_insights(
    *,
    base_item: Item,
    linked_words: list[Item],
    source_language: str,
    target_language: str,
) -> str:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="compare_words_insights",
        system_prompt=_render_prompt(
            COMPARE_WORDS_INSIGHTS_PROMPT,
            source_name=source_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Main word ({target_name}): {base_item.german_text}\n"
            f"Main meaning ({source_name}): {base_item.spanish_text}\n"
            f"Main word type: {base_item.word_type}\n"
            "Confusing words:\n"
            + "\n".join(
                f"- {word.german_text} | {word.spanish_text} | {word.word_type}"
                for word in linked_words
            )
            + "\n"
        ),
        timeout_seconds=12,
        model=_require_question_model(),
        temperature=0.2,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    insights = str(parsed.get("insights", "")).strip()
    if not insights:
        raise RuntimeError("Question model request failed")
    return insights[:4000]


class ContentItemCompareWordsInsightsView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        force_refresh = bool(request.data.get("force_refresh"))
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        linked_words = list(
            item.confusing_with.filter(
                item_type=Item.ItemType.WORD,
                source_language=source_language,
                target_language=target_language,
            ).order_by("german_text", "spanish_text", "id")
        )
        if not linked_words:
            return Response({"detail": "No confusing words configured"}, status=status.HTTP_400_BAD_REQUEST)

        existing_insights = str(item.compare_words_insights or "").strip()
        if existing_insights and not force_refresh:
            return Response({"insights": existing_insights})

        try:
            insights = _generate_compare_word_insights(
                base_item=item,
                linked_words=linked_words,
                source_language=source_language,
                target_language=target_language,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.compare_words_insights = insights
        item.save(update_fields=["compare_words_insights", "updated_at"])
        return Response({"insights": insights})
