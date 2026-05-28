import structlog
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import StandardPageNumberPagination
from core.permissions import IsAdminJWT, IsJWTAuthenticated

from .models import Video
from .serializers import VideoSerializer, VideoUpdateSerializer

logger = structlog.get_logger(__name__)


class AdminVideoListView(APIView):
    """GET /api/v1/videos/ — all videos for admins, any status, paginated."""

    permission_classes = [IsJWTAuthenticated, IsAdminJWT]

    def get(self, request: Request) -> Response:
        qs = Video.objects.filter(deleted_at__isnull=True).order_by("-created_at")

        if search := request.query_params.get("search"):
            qs = qs.filter(Q(title__icontains=search) | Q(category__icontains=search))
        if status_filter := request.query_params.get("status"):
            qs = qs.filter(status=status_filter)

        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(VideoSerializer(page, many=True).data)


class VideoDetailView(APIView):
    permission_classes = [IsJWTAuthenticated]

    def get(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        return Response(VideoSerializer(video).data)

    def patch(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        user_id = str(request.user.id)
        is_admin = request.user.has_role("admin", "superadmin")

        if not is_admin and str(video.uploader_id) != user_id:
            raise PermissionDenied("You can only edit your own videos.")

        serializer = VideoUpdateSerializer(video, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info("video_updated", video_id=str(video_id), user_id=user_id)
        return Response(VideoSerializer(video).data)

    def delete(self, request: Request, video_id: str) -> Response:
        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        user_id = str(request.user.id)
        is_admin = request.user.has_role("admin", "superadmin")

        if not is_admin and str(video.uploader_id) != user_id:
            raise PermissionDenied("You can only delete your own videos.")

        video.deleted_at = timezone.now()
        video.status = Video.STATUS_DELETED
        video.save(update_fields=["deleted_at", "status", "updated_at"])
        logger.info("video_soft_deleted", video_id=str(video_id), user_id=user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VideoPublishView(APIView):
    """Only admins can publish videos."""

    permission_classes = [IsJWTAuthenticated, IsAdminJWT]

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
        logger.info("video_published", video_id=str(video_id), user_id=str(request.user.id))
        return Response(VideoSerializer(video).data)
