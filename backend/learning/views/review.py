from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import Item
from ..serializers import SubmitReviewSerializer
from ..srs import apply_review_result


class SubmitReviewView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = SubmitReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]
        correct = serializer.validated_data["correct"]
        direction = serializer.validated_data.get("direction")

        try:
            item = apply_user_scope(Item.objects, user).get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        if direction is None:
            return Response({"detail": "Reviews require direction"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            apply_review_result(item, correct, direction=direction)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True})
