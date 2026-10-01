from django.core.signing import BadSignature
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import get_request_user
from ..construction_patterns.storage import save_preview


class ConstructionPatternSaveView(APIView):
    def post(self, request):
        user = get_request_user(request)
        if user is None:
            return Response(status=401)
        token = request.data.get("save_token")
        if not isinstance(token, str) or not token:
            return Response({"detail": "A construction preview is required."}, status=400)
        try:
            item, created = save_preview(token, user=user)
        except (BadSignature, ValueError, KeyError, TypeError):
            return Response({"detail": "Invalid or expired construction preview. Open it again."}, status=400)
        return Response({"id": item.pk, "created": created}, status=201 if created else 200)
