from django.http import JsonResponse
from django.utils import timezone


class HealthCheckMiddleware:
    """Serve the infrastructure probe before Django validates its internal Host header."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/api/health":
            return JsonResponse(
                {
                    "status": "ok",
                    "service": "smart-language-learning-backend",
                    "timestamp": timezone.now().isoformat(),
                }
            )
        return self.get_response(request)
