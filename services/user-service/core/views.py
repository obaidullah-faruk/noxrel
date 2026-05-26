from django.db import connection
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        checks = {"db": False, "cache": False}

        try:
            connection.ensure_connection()
            checks["db"] = True
        except Exception:
            pass

        try:
            cache.set("_health_ping", "pong", timeout=5)
            checks["cache"] = cache.get("_health_ping") == "pong"
        except Exception:
            pass

        ok = all(checks.values())
        return Response(
            {"status": "ok" if ok else "degraded", "service": "user-service", "checks": checks},
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
