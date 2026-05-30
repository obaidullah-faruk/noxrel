from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("", include("django_prometheus.urls")),
    path("admin/", admin.site.urls),
    path("health/", include("core.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # App routes — prefixed with api/v1/ to match Kong proxy paths
    path("api/v1/videos/upload/", include("uploaders.urls")),
    path("api/v1/videos/", include("videos.urls")),
    path("api/v1/catalog/", include("catalog.urls")),
    # Internal — called by other services (no gateway, no prefix)
    path("internal/", include("videos.internal_urls")),
]
