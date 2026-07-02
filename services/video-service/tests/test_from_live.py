import uuid

import pytest
from rest_framework.test import APIClient

from videos.models import Video

URL = "/internal/videos/from_live"


def _payload(session_id):
    return {
        "session_id": str(session_id),
        "uploader_id": str(uuid.uuid4()),
        "title": "My Live Stream",
        "description": "recorded live",
        "hls_manifest_url": "https://cdn.test/sessions/abc/replay_master.m3u8",
        "duration_seconds": 1234.5,
    }


@pytest.fixture
def internal_client():
    client = APIClient()
    client.credentials(HTTP_X_INTERNAL_KEY="dev-internal-key")
    return client


@pytest.mark.django_db
class TestFromLive:
    def test_creates_ready_live_video(self, internal_client):
        session_id = uuid.uuid4()
        resp = internal_client.post(URL, _payload(session_id), format="json")

        assert resp.status_code == 201
        video = Video.objects.get(id=resp.data["id"])
        assert video.is_live is True
        assert video.status == Video.STATUS_READY
        assert video.is_published is True
        assert video.published_at is not None
        assert str(video.live_session_id) == str(session_id)
        assert "live-segments" not in video.hls_manifest_url  # points at replay master
        assert video.hls_manifest_url.endswith("replay_master.m3u8")

    def test_idempotent_on_session_id(self, internal_client):
        session_id = uuid.uuid4()
        payload = _payload(session_id)

        first = internal_client.post(URL, payload, format="json")
        second = internal_client.post(URL, payload, format="json")

        assert first.status_code == 201
        assert second.status_code == 200
        assert first.data["id"] == second.data["id"]
        assert Video.objects.filter(live_session_id=session_id).count() == 1

    def test_rejects_call_without_internal_key(self):
        resp = APIClient().post(URL, _payload(uuid.uuid4()), format="json")
        assert resp.status_code in (401, 403)
