from django.utils import timezone
from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import Item
from ..serializers import SubmitReviewSerializer
from ..srs import apply_review_result
from ..streaks import record_completed_item


class SubmitReviewView(APIView):
    @transaction.atomic
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = SubmitReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]
        correct = serializer.validated_data["correct"]
        direction = serializer.validated_data.get("direction")

        try:
            item = apply_user_scope(Item.objects.select_for_update(), user).get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        if direction is None:
            return Response({"detail": "Reviews require direction"}, status=status.HTTP_400_BAD_REQUEST)

        version = serializer.validated_data.get("review_version")
        current_version = getattr(item, f"review_count_{direction}")
        if item.item_type == Item.ItemType.PATTERN and version is None:
            return Response({"detail": "A review version is required"}, status=400)
        if version is not None:
            if version > current_version:
                return Response({"detail": "Invalid review version"}, status=400)
            if version < current_version:
                return Response({"ok": True})

        try:
            apply_review_result(item, correct, direction=direction)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not correct and item.item_type != Item.ItemType.PATTERN:
            item.is_difficult = True
            item.difficult_marked_at = timezone.now()
            item.save(update_fields=["is_difficult", "difficult_marked_at", "updated_at"])
        record_completed_item(user, item, direction)
        return Response({"ok": True})
