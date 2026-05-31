from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.metrics import metrics_view

urlpatterns = [
    # Multiprocess-aware /metrics — aggregates all gunicorn workers. Replaces
    # django_prometheus.urls, whose view only reports the worker serving the scrape.
    path("metrics", metrics_view, name="prometheus-django-metrics"),
    path("admin/", admin.site.urls),
    # Health (no version — infra probes hit this directly)
    path("health", include("core.urls")),
    # API v1
    path("api/v1/", include("auth_api.urls", namespace="auth_api")),
    path("api/v1/", include("accounts.urls", namespace="accounts")),
    path("api/v1/", include("roles.urls", namespace="roles")),
    path("api/v1/", include("subscriptions.urls", namespace="subscriptions")),
    # OpenAPI schema + Swagger UI
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
