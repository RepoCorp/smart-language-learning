from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..languages import STUDY_LANGUAGE_LABELS
from ..learning_content.strategies.bank_words import DEFINITIONS_BY_KEY, MATCHERS, word_page
from ..models import Item


class LearningContentBankWordsView(APIView):
    def get(self, request, definition_key, strategy_id):
        user = get_request_user(request)
        if user is None:
            return Response(status=401)
        definition = DEFINITIONS_BY_KEY.get(definition_key)
        matcher = MATCHERS.get(strategy_id)
        if definition is None or strategy_id not in definition.strategies or matcher is None:
            return Response(status=404)
        source = request.query_params.get("source_language", "").strip().lower()
        try:
            offset = int(request.query_params.get("offset", "0"))
        except ValueError:
            return Response(status=400)
        if source not in STUDY_LANGUAGE_LABELS or source == definition.language or offset < 0:
            return Response(status=400)
        items = Item.objects.filter(
            user=user, item_type=Item.ItemType.WORD,
            source_language=source, target_language=definition.language,
        )
        response = Response(word_page(items, definition, matcher, offset))
        response["Cache-Control"] = "no-store"
        return response
