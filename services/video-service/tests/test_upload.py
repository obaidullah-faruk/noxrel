from unittest.mock import patch

import pytest

from uploaders.models import VideoMultipartUpload
from videos.models import Video


@pytest.mark.django_db
class TestUploadInit:
    @patch("uploaders.views.s3.create_multipart_upload", return_value="s3-upload-id-123")
    @patch("uploaders.views.s3.generate_presigned_part_urls")
    def test_init_creates_video_and_returns_presigned_parts(self, mock_urls, mock_create, authed_client):
        mock_urls.return_value = [{"part_number": 1, "url": "https://s3.example.com/part1"}]
        client, user_id = authed_client

        resp = client.post(
            "/api/v1/videos/upload/init/",
            {"title": "My Video", "file_size_bytes": 10 * 1024 * 1024},
            format="json",
        )

        assert resp.status_code == 201
        assert "video_id" in resp.data
        assert "presigned_parts" in resp.data
        assert resp.data["total_parts"] == 2  # 10MB / 5MB = 2 parts

        video = Video.objects.get(id=resp.data["video_id"])
        assert str(video.uploader_id) == user_id
        assert video.status == Video.STATUS_UPLOADING

    def test_init_without_title_returns_400(self, authed_client):
        client, _ = authed_client
        resp = client.post("/api/v1/videos/upload/init/", {"file_size_bytes": 5000000}, format="json")
        assert resp.status_code == 400

    def test_init_without_file_size_returns_400(self, authed_client):
        client, _ = authed_client
        resp = client.post("/api/v1/videos/upload/init/", {"title": "Test"}, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestUploadComplete:
    @patch("uploaders.views.s3.complete_multipart_upload")
    @patch("uploaders.views.publish")
    def test_complete_transitions_video_to_processing(self, mock_publish, mock_s3, authed_client):
        client, user_id = authed_client

        video = Video.objects.create(
            uploader_id=user_id,
            title="Test",
            raw_file_size_bytes=5 * 1024 * 1024,
            status=Video.STATUS_UPLOADING,
        )
        from django.utils import timezone

        multipart = VideoMultipartUpload.objects.create(
            video=video,
            s3_upload_id="s3-upload-123",
            s3_bucket="raw-videos",
            s3_key=f"raw/uploads/{video.id}/original",
            total_parts=1,
            expires_at=timezone.now() + timezone.timedelta(hours=12),
        )

        resp = client.post(
            "/api/v1/videos/upload/complete/",
            {
                "upload_id": str(multipart.id),
                "part_etags": [{"part_number": 1, "etag": "abc123"}],
            },
            format="json",
        )

        assert resp.status_code == 200
        assert resp.data["video_id"] == str(video.id)

        video.refresh_from_db()
        assert video.status == Video.STATUS_PROCESSING
        mock_publish.assert_called_once()
        call_kwargs = mock_publish.call_args
        assert call_kwargs[1]["topic"] == "video.uploaded" or call_kwargs[0][0] == "video.uploaded"

    def test_complete_missing_params_returns_400(self, authed_client):
        client, _ = authed_client
        resp = client.post("/api/v1/videos/upload/complete/", {}, format="json")
        assert resp.status_code == 400
