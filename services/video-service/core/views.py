import boto3
from botocore.exceptions import BotoCoreError, ClientError
from confluent_kafka import Consumer, KafkaException
from django.conf import settings
from django.db import connection
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        checks = {"database": False, "s3": False, "kafka": False}

        try:
            connection.ensure_connection()
            checks["database"] = True
        except Exception:
            pass

        try:
            s3 = boto3.client(
                "s3",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                endpoint_url=settings.AWS_S3_ENDPOINT_URL or None,
            )
            s3.list_buckets()
            checks["s3"] = True
        except (BotoCoreError, ClientError, Exception):
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
            {"status": "ok" if ok else "degraded", "service": "video-service", "checks": checks},
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
