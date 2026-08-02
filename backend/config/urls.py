from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path

urlpatterns = [
    path("", lambda request: HttpResponse("ok", content_type="text/plain")),
    path("admin/", admin.site.urls),
    path("api/", include("learning.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
