from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Item
from ..serializers import MarkSeenSerializer
from ..srs import mark_item_seen


class MarkSeenView(APIView):
    def post(self, request: Request) -> Response:
        serializer = MarkSeenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]

        try:
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        mark_item_seen(item)
        return Response({"ok": True})
