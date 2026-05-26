from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", include("core.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # App routes
    path("videos/upload/", include("uploaders.urls")),
    path("videos/", include("videos.urls")),
    path("catalog/", include("catalog.urls")),
    # Internal — called by other services
    path("internal/", include("videos.internal_urls")),
]
