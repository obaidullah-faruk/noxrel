from rest_framework import serializers

from .models import TranscodeJob, Video


class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = [
            "id",
            "uploader_id",
            "title",
            "description",
            "tags",
            "category",
            "age_rating",
            "raw_file_size_bytes",
            "duration_seconds",
            "status",
            "hls_manifest_url",
            "dash_manifest_url",
            "thumbnail_url",
            "sprite_url",
            "available_qualities",
            "is_published",
            "published_at",
            "view_count",
            "average_rating",
            "rating_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uploader_id",
            "status",
            "hls_manifest_url",
            "dash_manifest_url",
            "thumbnail_url",
            "sprite_url",
            "available_qualities",
            "is_published",
            "published_at",
            "view_count",
            "average_rating",
            "rating_count",
            "created_at",
            "updated_at",
        ]


class VideoUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ["title", "description", "tags", "category", "age_rating"]


class TranscodeJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranscodeJob
        fields = [
            "id",
            "video_id",
            "status",
            "mediaconvert_job_id",
            "attempts",
            "error_message",
            "started_at",
            "completed_at",
            "created_at",
        ]
        read_only_fields = fields
