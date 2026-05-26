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
