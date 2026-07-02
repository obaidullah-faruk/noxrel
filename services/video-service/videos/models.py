import uuid

from django.db import models


class Video(models.Model):
    STATUS_UPLOADING = "uploading"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"
    STATUS_DELETED = "deleted"

    STATUS_CHOICES = [
        (STATUS_UPLOADING, "Uploading"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready"),
        (STATUS_FAILED, "Failed"),
        (STATUS_DELETED, "Deleted"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Plain UUID from JWT header — no FK to User Service DB
    uploader_id = models.UUIDField(db_index=True)

    title = models.CharField(max_length=256)
    description = models.TextField(blank=True)
    # JSONField stores a list; PostgreSQL uses native array in production migration
    tags = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=64, blank=True)
    age_rating = models.CharField(max_length=8, blank=True)

    # Raw upload storage
    raw_s3_key = models.CharField(max_length=512, blank=True)
    raw_file_size_bytes = models.BigIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)

    # Status machine
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_UPLOADING, db_index=True)

    # Transcoding outputs (populated by Transcode Worker via Kafka)
    hls_manifest_url = models.TextField(blank=True)
    dash_manifest_url = models.TextField(blank=True)
    thumbnail_url = models.TextField(blank=True)
    sprite_url = models.TextField(blank=True)
    available_qualities = models.JSONField(default=list, blank=True)

    # Publishing
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    is_live = models.BooleanField(default=False)
    # Links a replay video to its live session; makes /internal/videos/from_live
    # idempotent under live-service retries.
    live_session_id = models.UUIDField(null=True, blank=True, unique=True)

    # Denormalized stats (synced via Kafka from Social Service)
    view_count = models.BigIntegerField(default=0)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    rating_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "videos"
        indexes = [
            models.Index(fields=["-published_at"], name="idx_videos_published"),
            models.Index(fields=["category", "-published_at"], name="idx_videos_category"),
        ]

    def __str__(self) -> str:
        return f"{self.title} [{self.status}]"


class TranscodeJob(models.Model):
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name="transcode_jobs")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    mediaconvert_job_id = models.CharField(max_length=128, blank=True)
    attempts = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "transcode_jobs"

    def __str__(self) -> str:
        return f"TranscodeJob({self.video_id}) [{self.status}]"


class UploaderProfile(models.Model):
    """Local projection of uploader display info, populated by user.profile_updated Kafka events."""

    user_id = models.UUIDField(primary_key=True)
    display_name = models.CharField(max_length=128)
    avatar_url = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "uploader_profiles"

    def __str__(self) -> str:
        return f"UploaderProfile({self.user_id})"
