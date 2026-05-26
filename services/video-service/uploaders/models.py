import uuid

from django.db import models

from videos.models import Video


class VideoMultipartUpload(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    video = models.OneToOneField(Video, on_delete=models.CASCADE, related_name="multipart_upload")
    s3_upload_id = models.CharField(max_length=128)
    s3_bucket = models.CharField(max_length=128)
    s3_key = models.CharField(max_length=512)
    total_parts = models.IntegerField(null=True, blank=True)
    # Stored as [{"PartNumber": int, "ETag": str}]
    uploaded_parts = models.JSONField(default=list)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "video_multipart_uploads"

    def __str__(self) -> str:
        return f"MultipartUpload({self.video_id})"
