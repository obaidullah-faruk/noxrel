from django.contrib import admin

from .models import TranscodeJob, UploaderProfile, Video


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ["title", "uploader_id", "status", "is_published", "view_count", "created_at"]
    list_filter = ["status", "is_published", "category"]
    search_fields = ["title", "description"]
    readonly_fields = ["id", "uploader_id", "created_at", "updated_at"]
    ordering = ["-created_at"]


@admin.register(TranscodeJob)
class TranscodeJobAdmin(admin.ModelAdmin):
    list_display = ["video_id", "status", "attempts", "started_at", "completed_at"]
    list_filter = ["status"]
    readonly_fields = ["id", "created_at"]


@admin.register(UploaderProfile)
class UploaderProfileAdmin(admin.ModelAdmin):
    list_display = ["user_id", "display_name", "updated_at"]
    readonly_fields = ["user_id"]
