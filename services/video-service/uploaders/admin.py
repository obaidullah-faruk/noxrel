from django.contrib import admin

from .models import VideoMultipartUpload


@admin.register(VideoMultipartUpload)
class VideoMultipartUploadAdmin(admin.ModelAdmin):
    list_display = ["id", "video_id", "s3_bucket", "total_parts", "expires_at", "created_at"]
    readonly_fields = ["id", "created_at"]
