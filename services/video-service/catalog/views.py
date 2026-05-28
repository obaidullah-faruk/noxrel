import structlog
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import StandardPageNumberPagination
from core.permissions import IsJWTAuthenticated, require_permission
from videos.models import Video
from videos.serializers import VideoSerializer

logger = structlog.get_logger(__name__)

_PUBLISHED_BASE = dict(status=Video.STATUS_READY, is_published=True, deleted_at__isnull=True)

_CanWatch = require_permission("video:watch")


class VideoListView(APIView):
    """GET /api/v1/catalog/ — paginated list with optional filters."""

    permission_classes = [IsJWTAuthenticated, _CanWatch]

    def get(self, request: Request) -> Response:
        qs = Video.objects.filter(**_PUBLISHED_BASE).order_by("-published_at")

        if category := request.query_params.get("category"):
            qs = qs.filter(category=category)
        if tag := request.query_params.get("tag"):
            qs = qs.filter(tags__contains=[tag])

        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(VideoSerializer(page, many=True).data)


class TrendingView(APIView):
    """GET /api/v1/catalog/trending/ — sorted by view_count."""

    permission_classes = [IsJWTAuthenticated, _CanWatch]

    def get(self, request: Request) -> Response:
        qs = Video.objects.filter(**_PUBLISHED_BASE).order_by("-view_count", "-published_at")[:50]
        return Response(VideoSerializer(qs, many=True).data)


class RelatedVideoView(APIView):
    """GET /api/v1/catalog/<video_id>/related/ — same category, similar tags."""

    permission_classes = [IsJWTAuthenticated, _CanWatch]

    def get(self, request: Request, video_id: str) -> Response:
        from django.shortcuts import get_object_or_404

        video = get_object_or_404(Video, id=video_id, deleted_at__isnull=True)
        qs = (
            Video.objects.filter(**_PUBLISHED_BASE, category=video.category)
            .exclude(id=video.id)
            .order_by("-view_count")[:10]
        )
        return Response(VideoSerializer(qs, many=True).data)
