import structlog
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import get_gateway_user_id, require_permission

from .models import Video
from .serializers import VideoSerializer, VideoUpdateSerializer

logger = structlog.get_logger(__name__)


class VideoDetailView(APIView):
    permission_classes = [require_permission("video:watch")]

    def get(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        return Response(VideoSerializer(video).data)

    def patch(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        user_id = get_gateway_user_id(request)

        if str(video.uploader_id) != user_id:
            raise PermissionDenied("You can only edit your own videos.")

        serializer = VideoUpdateSerializer(video, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info("video_updated", video_id=str(video_id), user_id=user_id)
        return Response(VideoSerializer(video).data)

    def delete(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        user_id = get_gateway_user_id(request)

        if str(video.uploader_id) != user_id:
            raise PermissionDenied("You can only delete your own videos.")

        video.deleted_at = timezone.now()
        video.status = Video.STATUS_DELETED
        video.save(update_fields=["deleted_at", "status", "updated_at"])
        logger.info("video_soft_deleted", video_id=str(video_id), user_id=user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VideoPublishView(APIView):
    permission_classes = [require_permission("video:publish")]

    def post(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)

        if video.status != Video.STATUS_READY:
            return Response(
                {"detail": "Video is not ready for publishing.", "code": "not_ready"},
                status=status.HTTP_409_CONFLICT,
            )

        video.is_published = True
        video.published_at = timezone.now()
        video.save(update_fields=["is_published", "published_at", "updated_at"])
        logger.info("video_published", video_id=str(video_id))
        return Response(VideoSerializer(video).data)
