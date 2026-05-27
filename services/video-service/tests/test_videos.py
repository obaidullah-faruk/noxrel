import uuid

import pytest

from videos.models import Video


@pytest.mark.django_db
class TestVideoDetail:
    def _make_video(self, uploader_id, status=Video.STATUS_READY, is_published=True):
        return Video.objects.create(
            uploader_id=uploader_id,
            title="Test Video",
            status=status,
            is_published=is_published,
        )

    def test_get_video_returns_data(self, authed_client):
        client, user_id = authed_client
        video = self._make_video(user_id)
        url = f"/api/v1/videos/{video.id}/"
        resp = client.get(url)
        assert resp.status_code == 200
        assert str(resp.data["id"]) == str(video.id)

    def test_get_deleted_video_returns_404(self, authed_client):
        from django.utils import timezone

        client, user_id = authed_client
        video = self._make_video(user_id)
        video.deleted_at = timezone.now()
        video.status = Video.STATUS_DELETED
        video.save()
        resp = client.get(f"/api/v1/videos/{video.id}/")
        assert resp.status_code == 404

    def test_patch_own_video(self, authed_client):
        client, user_id = authed_client
        video = self._make_video(user_id)
        resp = client.patch(f"/api/v1/videos/{video.id}/", {"title": "Updated"}, format="json")
        assert resp.status_code == 200
        assert resp.data["title"] == "Updated"

    def test_patch_other_video_forbidden(self, authed_client):
        client, user_id = authed_client
        other_id = str(uuid.uuid4())
        video = self._make_video(other_id)
        resp = client.patch(f"/api/v1/videos/{video.id}/", {"title": "Hack"}, format="json")
        assert resp.status_code == 403

    def test_soft_delete_own_video(self, authed_client):
        client, user_id = authed_client
        video = self._make_video(user_id)
        resp = client.delete(f"/api/v1/videos/{video.id}/")
        assert resp.status_code == 204
        video.refresh_from_db()
        assert video.deleted_at is not None
        assert video.status == Video.STATUS_DELETED

    def test_publish_ready_video(self, authed_client):
        client, user_id = authed_client
        video = self._make_video(user_id, status=Video.STATUS_READY, is_published=False)
        resp = client.post(f"/api/v1/videos/{video.id}/publish/")
        assert resp.status_code == 200
        video.refresh_from_db()
        assert video.is_published is True

    def test_publish_not_ready_video_returns_conflict(self, authed_client):
        client, user_id = authed_client
        video = self._make_video(user_id, status=Video.STATUS_PROCESSING, is_published=False)
        resp = client.post(f"/api/v1/videos/{video.id}/publish/")
        assert resp.status_code == 409

    def test_unauthenticated_returns_401(self, api_client):
        # No JWT and no gateway headers → DRF authentication layer returns 401
        video_id = uuid.uuid4()
        resp = api_client.get(f"/api/v1/videos/{video_id}/")
        assert resp.status_code == 401
