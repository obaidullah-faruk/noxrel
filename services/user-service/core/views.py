from confluent_kafka import Consumer, KafkaException
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    # Exempt from the global AnonRateThrottle: infra probes hit /health every
    # 15s (~5760/day), which would otherwise blow past the 100/day anon limit
    # and 429 the healthcheck, marking a healthy container unhealthy.
    throttle_classes: list = []

    def get(self, request: Request) -> Response:
        checks = {"database": False, "redis": False, "kafka": False}

        try:
            connection.ensure_connection()
            checks["database"] = True
        except Exception:
            pass

        try:
            cache.set("_health_ping", "pong", timeout=5)
            checks["redis"] = cache.get("_health_ping") == "pong"
        except Exception:
            pass

        try:
            c = Consumer(
                {
                    "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                    "group.id": "_health_check",
                    "socket.timeout.ms": 3000,
                }
            )
            c.list_topics(timeout=3)
            c.close()
            checks["kafka"] = True
        except (KafkaException, Exception):
            pass

        ok = all(checks.values())
        return Response(
            {"status": "ok" if ok else "degraded", "service": "user-service", "checks": checks},
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
