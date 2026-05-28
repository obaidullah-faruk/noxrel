"""Pagination tests for video admin and catalog list endpoints."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from videos.models import Video


def _admin_client(user_id: str) -> APIClient:
    client = APIClient()
    client.credentials(
        HTTP_X_USER_ID=user_id,
        HTTP_X_USER_ROLES="admin",
        HTTP_X_USER_PERMISSIONS="video:upload,video:watch,video:publish,video:delete",
    )
    return client


def _make_videos(uploader_id: str, n: int, *, published: bool = False) -> list:
    return [
        Video.objects.create(
            uploader_id=uploader_id,
            title=f"Video {i}",
            status=Video.STATUS_READY,
            is_published=published,
        )
        for i in range(n)
    ]


@pytest.mark.django_db
class TestAdminVideoListPagination:
    def test_default_page_size_is_20(self, admin_client):
        client, user_id = admin_client
        _make_videos(user_id, 25)
        resp = client.get("/api/v1/videos/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) == 20

    def test_custom_page_size(self, admin_client):
        client, user_id = admin_client
        _make_videos(user_id, 15)
        resp = client.get("/api/v1/videos/?page_size=5")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) == 5
        assert resp.data["next"] is not None

    def test_page_size_capped_at_100(self, admin_client):
        client, user_id = admin_client
        _make_videos(user_id, 110)
        resp = client.get("/api/v1/videos/?page_size=200")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) <= 100

    def test_second_page_no_overlap(self, admin_client):
        client, user_id = admin_client
        _make_videos(user_id, 10)
        resp1 = client.get("/api/v1/videos/?page_size=5&page=1")
        resp2 = client.get("/api/v1/videos/?page_size=5&page=2")
        assert resp1.status_code == status.HTTP_200_OK
        assert resp2.status_code == status.HTTP_200_OK
        ids1 = {v["id"] for v in resp1.data["results"]}
        ids2 = {v["id"] for v in resp2.data["results"]}
        assert ids1.isdisjoint(ids2)

    def test_response_envelope_shape(self, admin_client):
        client, _ = admin_client
        resp = client.get("/api/v1/videos/")
        assert resp.status_code == status.HTTP_200_OK
        for key in ("count", "next", "previous", "results"):
            assert key in resp.data

    def test_last_page_has_no_next(self, admin_client):
        client, user_id = admin_client
        _make_videos(user_id, 3)
        resp = client.get("/api/v1/videos/?page_size=100")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["next"] is None


@pytest.mark.django_db
class TestCatalogPagination:
    def test_default_page_size_is_20(self, authed_client):
        client, user_id = authed_client
        _make_videos(user_id, 25, published=True)
        resp = client.get("/api/v1/catalog/")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) == 20

    def test_custom_page_size(self, authed_client):
        client, user_id = authed_client
        _make_videos(user_id, 15, published=True)
        resp = client.get("/api/v1/catalog/?page_size=5")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) == 5

    def test_page_size_capped_at_100(self, authed_client):
        client, user_id = authed_client
        _make_videos(user_id, 110, published=True)
        resp = client.get("/api/v1/catalog/?page_size=200")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) <= 100

    def test_unpublished_excluded(self, authed_client):
        client, user_id = authed_client
        _make_videos(user_id, 5, published=False)
        resp = client.get("/api/v1/catalog/?page_size=100")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["count"] == 0
