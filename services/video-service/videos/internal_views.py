from django.utils import timezone
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsInternalCall

from .models import Video
from .serializers import VideoSerializer


class InternalVideoDetailView(APIView):
    """Used by other services (Streaming, Search) — no JWT, internal key only."""

    authentication_classes = []
    permission_classes = [IsInternalCall]

    def get(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        return Response(VideoSerializer(video).data)


class FromLiveView(APIView):
    """Called only by live-service after a stream ends to register the replay.

    Idempotent on live_session_id, so live-service retries never create
    duplicate videos. The HLS manifest points to the live-segments bucket via
    CDN — NOT transcoded-videos — so these rows must never be sent through the
    transcode-worker pipeline (no video.uploaded event is emitted for them).
    """

    authentication_classes = []
    permission_classes = [IsInternalCall]

    def post(self, request: Request) -> Response:
        data = request.data
        video, created = Video.objects.get_or_create(
            live_session_id=data["session_id"],
            defaults={
                "uploader_id": data["uploader_id"],
                "title": data["title"],
                "description": data.get("description", ""),
                "status": Video.STATUS_READY,
                "hls_manifest_url": data["hls_manifest_url"],
                "duration_seconds": data.get("duration_seconds"),
                "is_published": True,
                "published_at": timezone.now(),
                "is_live": True,
            },
        )
        return Response(
            {"id": str(video.id)},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
