import math

import structlog
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.kafka import publish
from core.permissions import get_gateway_user_id, require_permission
from videos.models import TranscodeJob, Video

from . import s3
from .models import VideoMultipartUpload

logger = structlog.get_logger(__name__)


class UploadInitView(APIView):
    """
    POST /videos/upload/init
    Body: { title, description?, category?, tags?, age_rating?, file_size_bytes }
    Returns: { upload_id, video_id, presigned_parts: [{part_number, url}] }
    """

    permission_classes = [require_permission("video:upload")]

    def post(self, request: Request) -> Response:
        user_id = get_gateway_user_id(request)
        file_size_bytes = request.data.get("file_size_bytes")
        title = request.data.get("title", "").strip()

        if not title:
            return Response(
                {"detail": "title is required.", "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not file_size_bytes:
            return Response(
                {"detail": "file_size_bytes is required.", "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            file_size_bytes = int(file_size_bytes)
        except (ValueError, TypeError):
            return Response(
                {"detail": "file_size_bytes must be an integer.", "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        chunk_size = settings.S3_MULTIPART_CHUNK_SIZE_MB * 1024 * 1024
        part_count = max(1, math.ceil(file_size_bytes / chunk_size))

        video = Video.objects.create(
            uploader_id=user_id,
            title=title,
            description=request.data.get("description", ""),
            category=request.data.get("category", ""),
            tags=request.data.get("tags", []),
            age_rating=request.data.get("age_rating", ""),
            raw_file_size_bytes=file_size_bytes,
            status=Video.STATUS_UPLOADING,
        )

        s3_key = f"raw/uploads/{video.id}/original"
        s3_upload_id = s3.create_multipart_upload(settings.S3_RAW_BUCKET, s3_key)
        presigned_parts = s3.generate_presigned_part_urls(
            bucket=settings.S3_RAW_BUCKET,
            key=s3_key,
            upload_id=s3_upload_id,
            part_count=part_count,
            ttl=settings.S3_PRESIGNED_UPLOAD_TTL,
        )

        VideoMultipartUpload.objects.create(
            video=video,
            s3_upload_id=s3_upload_id,
            s3_bucket=settings.S3_RAW_BUCKET,
            s3_key=s3_key,
            total_parts=part_count,
            expires_at=timezone.now() + timezone.timedelta(seconds=settings.S3_PRESIGNED_UPLOAD_TTL),
        )

        logger.info("upload_initiated", video_id=str(video.id), user_id=user_id, parts=part_count)

        return Response(
            {
                "video_id": str(video.id),
                "upload_id": str(video.multipart_upload.id),
                "s3_upload_id": s3_upload_id,
                "presigned_parts": presigned_parts,
                "total_parts": part_count,
            },
            status=status.HTTP_201_CREATED,
        )


class UploadCompleteView(APIView):
    """
    POST /videos/upload/complete
    Body: { upload_id, part_etags: [{part_number, etag}] }
    Returns: { video_id }
    """

    permission_classes = [require_permission("video:upload")]

    def post(self, request: Request) -> Response:
        upload_id = request.data.get("upload_id")
        part_etags = request.data.get("part_etags", [])

        if not upload_id or not part_etags:
            return Response(
                {"detail": "upload_id and part_etags are required.", "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            multipart = VideoMultipartUpload.objects.select_related("video").get(id=upload_id)
        except VideoMultipartUpload.DoesNotExist:
            return Response(
                {"detail": "Upload session not found.", "code": "not_found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        video = multipart.video
        if video.status != Video.STATUS_UPLOADING:
            return Response(
                {"detail": "Upload already completed or failed.", "code": "conflict"},
                status=status.HTTP_409_CONFLICT,
            )

        # S3 expects [{PartNumber: int, ETag: str}]
        parts = [{"PartNumber": p["part_number"], "ETag": p["etag"]} for p in part_etags]

        s3.complete_multipart_upload(
            bucket=multipart.s3_bucket,
            key=multipart.s3_key,
            upload_id=multipart.s3_upload_id,
            parts=parts,
        )

        video.raw_s3_key = multipart.s3_key
        video.status = Video.STATUS_PROCESSING
        video.save(update_fields=["raw_s3_key", "status", "updated_at"])

        TranscodeJob.objects.create(video=video)

        publish(
            topic="video.uploaded",
            payload={
                "video_id": str(video.id),
                "uploader_id": str(video.uploader_id),
                "s3_bucket": multipart.s3_bucket,
                "s3_key": multipart.s3_key,
                "raw_file_size_bytes": video.raw_file_size_bytes,
                "title": video.title,
            },
            key=str(video.id),
        )

        logger.info("upload_completed", video_id=str(video.id))
        return Response({"video_id": str(video.id)}, status=status.HTTP_200_OK)
