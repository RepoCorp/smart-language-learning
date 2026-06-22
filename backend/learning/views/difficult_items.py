from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import Item
from ..serializers import CompleteDifficultItemSerializer


class CompleteDifficultItemView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = CompleteDifficultItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]

        try:
            item = apply_user_scope(Item.objects, user).get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        item.is_difficult = False
        item.difficult_marked_at = None
        item.save(update_fields=["is_difficult", "difficult_marked_at", "updated_at"])
        return Response({"ok": True})
