from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..models import Item
from ..word_formation import CATALOGS, item_defaults, supports_pair


def language_pair(data):
    return {key: str(data.get(key, "")).strip().lower() for key in ("source_language", "target_language")}


class WordFormationView(APIView):
    def get(self, request):
        user = get_request_user(request)
        if user is None:
            return Response(status=401)
        pair = language_pair(request.query_params)
        saved = Item.objects.filter(user=user, item_type=Item.ItemType.PATTERN, **pair).order_by("pattern_key")
        return Response({
            "supported": supports_pair(pair["source_language"], pair["target_language"]),
            "saved": list(saved.values_list("pattern_key", flat=True)),
        })

    def post(self, request):
        user = get_request_user(request)
        if user is None:
            return Response(status=401)
        pair = language_pair(request.data)
        key = request.data.get("pattern_key")
        if (not supports_pair(pair["source_language"], pair["target_language"])
                or not isinstance(key, str) or key not in CATALOGS[pair["target_language"]]):
            return Response({"detail": "Unsupported word-building pattern or language pair."}, status=400)
        item, created = Item.objects.get_or_create(
            user=user, item_type=Item.ItemType.PATTERN, pattern_key=key, **pair,
            defaults=item_defaults(pair["source_language"], pair["target_language"], key),
        )
        return Response({"id": item.id}, status=201 if created else 200)
