from dataclasses import asdict

from rest_framework.response import Response
from rest_framework.views import APIView

from ..learning_content.catalog import DEFINITIONS
from .admin_access import require_admin


class LearningContentCatalogView(APIView):
    def get(self, request):
        if require_admin(request) is None:
            return Response(status=403)
        response = Response({"definitions": [asdict(definition) for definition in DEFINITIONS]})
        response["Cache-Control"] = "no-store"
        return response
