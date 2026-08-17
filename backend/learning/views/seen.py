from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import Item
from ..serializers import MarkSeenSerializer
from ..srs import mark_item_seen
from ..streaks import record_completed_item


class MarkSeenView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = MarkSeenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]

        try:
            item = apply_user_scope(Item.objects, user).get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        mark_item_seen(item)
        progress = record_completed_item(user, item, None)
        new_items_completed = int(progress.get("new_items_completed_today", 0))
        return Response({
            "ok": True,
            "new_items_completed_today": new_items_completed,
            "show_new_items_celebration": bool(progress.get("new_item_added")) and new_items_completed % 5 == 0,
        })
