from __future__ import annotations

from ...grammar_features import PHRASE_GRAMMAR_FEATURES, VERB_POSITION_MAIN_CLAUSE
from ...models import Item, ItemGrammarFeature
from ...prompts import PHRASE_GRAMMAR_FEATURES_PROMPT
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


def _grammar_feature_list() -> str:
    return "\n\n".join(
        f"{feature_key}:\n{description}"
        for feature_key, description in PHRASE_GRAMMAR_FEATURES.items()
    )


class ContentItemPhraseGrammarFeaturesView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.PHRASE,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Phrase not found"}, status=status.HTTP_404_NOT_FOUND)

        examples = (
            apply_user_scope(Item.objects, user)
            .filter(
                item_type=Item.ItemType.PHRASE,
                source_language=source_language,
                target_language=target_language,
                grammar_features__feature_key=VERB_POSITION_MAIN_CLAUSE,
            )
            .exclude(id=item.id)
            .order_by("?")[:5]
        )
        return Response(
            {
                "examples": [
                    {"target_text": example.german_text, "source_text": example.spanish_text}
                    for example in examples
                ]
            }
        )

    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.PHRASE,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Phrase not found"}, status=status.HTTP_404_NOT_FOUND)
        if target_language != "german":
            return Response({"feature_present": False})

        if item.grammar_features.filter(feature_key=VERB_POSITION_MAIN_CLAUSE).exists():
            return Response({"feature_present": True})

        parsed = _call_openai_json_logged(
            label="content_item_phrase_grammar_features",
            system_prompt=_render_prompt(
                PHRASE_GRAMMAR_FEATURES_PROMPT,
                sentence=item.german_text,
                grammar_features=_grammar_feature_list(),
            ),
            user_input=item.german_text,
            timeout_seconds=12,
            model=WORD_EXERCISE_MODEL,
            temperature=1.0,
            top_p=1.0,
            presence_penalty=0.0,
        )
        if not isinstance(parsed, list) or not all(isinstance(value, str) for value in parsed):
            return Response({"detail": "Failed to analyze phrase grammar"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        detected_features = set(parsed).intersection(PHRASE_GRAMMAR_FEATURES)
        feature_present = VERB_POSITION_MAIN_CLAUSE in detected_features
        if feature_present:
            ItemGrammarFeature.objects.get_or_create(item=item, feature_key=VERB_POSITION_MAIN_CLAUSE)
        return Response({"feature_present": feature_present})
