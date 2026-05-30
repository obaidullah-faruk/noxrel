import time

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from prometheus_client import Counter, Histogram

# Unified, cross-service HTTP metrics. The names and label schema match
# streaming-service (src/core/metrics.ts) so the Grafana platform-overview
# dashboard can aggregate every service with a single query. django-prometheus
# already exposes the /metrics endpoint and a richer django_http_* set; these
# add the platform-standard names on top of it.
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests, labelled by service, method, route and status.",
    ["service", "method", "route", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ["service", "method", "route", "status"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)


class PlatformMetricsMiddleware:
    """Records unified http_requests_total / http_request_duration_seconds.

    Uses the resolver match (route template) for the `route` label to keep
    cardinality bounded by routes rather than by path parameters.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.service = getattr(settings, "SERVICE_NAME", "django-service")

    def __call__(self, request: HttpRequest) -> HttpResponse:
        start = time.perf_counter()
        response = self.get_response(request)
        duration = time.perf_counter() - start

        # Never record the Prometheus scrape endpoint against itself.
        if request.path == "/metrics":
            return response

        labels = {
            "service": self.service,
            "method": request.method,
            "route": self._route(request),
            "status": str(response.status_code),
        }
        http_requests_total.labels(**labels).inc()
        http_request_duration_seconds.labels(**labels).observe(duration)
        return response

    @staticmethod
    def _route(request: HttpRequest) -> str:
        match = getattr(request, "resolver_match", None)
        if match is not None and match.route:
            return f"/{match.route}"
        return request.path
