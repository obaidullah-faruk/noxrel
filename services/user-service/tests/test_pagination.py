"""Pagination tests for admin list endpoints."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

from auth_api.tokens import UserRefreshToken
from roles.models import Role, UserRole

User = get_user_model()


def _make_admin_client(db, api_client):
    user = User.objects.create_superuser(
        email="pag_admin@example.com",
        username="pag_admin",
        display_name="Pag Admin",
        password="AdminP@ss1!",
    )
    role = Role.objects.get(name="admin")
    UserRole.objects.get_or_create(user=user, role=role)
    token = UserRefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return api_client


def _bulk_create_users(n: int, prefix: str = "paguser") -> list:
    return [
        User.objects.create_user(
            email=f"{prefix}{i}@example.com",
            username=f"{prefix}{i}",
            password="TestP@ss1!",
        )
        for i in range(n)
    ]


@pytest.mark.django_db
class TestAdminUserListPagination:
    def test_default_page_size_is_20(self, db, api_client):
        client = _make_admin_client(db, api_client)
        _bulk_create_users(25)
        resp = client.get("/api/v1/users")
        assert resp.status_code == status.HTTP_200_OK
        assert "count" in resp.data
        assert "results" in resp.data
        assert len(resp.data["results"]) == 20

    def test_custom_page_size(self, db, api_client):
        client = _make_admin_client(db, api_client)
        _bulk_create_users(15)
        resp = client.get("/api/v1/users?page_size=5")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) == 5
        assert resp.data["next"] is not None

    def test_page_size_capped_at_100(self, db, api_client):
        client = _make_admin_client(db, api_client)
        _bulk_create_users(110)
        resp = client.get("/api/v1/users?page_size=200")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]) <= 100

    def test_second_page_returns_next_window(self, db, api_client):
        client = _make_admin_client(db, api_client)
        _bulk_create_users(10, prefix="pguser")
        resp1 = client.get("/api/v1/users?page_size=5&page=1")
        resp2 = client.get("/api/v1/users?page_size=5&page=2")
        assert resp1.status_code == status.HTTP_200_OK
        assert resp2.status_code == status.HTTP_200_OK
        ids1 = {u["id"] for u in resp1.data["results"]}
        ids2 = {u["id"] for u in resp2.data["results"]}
        assert ids1.isdisjoint(ids2), "Pages must not overlap"

    def test_response_envelope_shape(self, db, api_client):
        client = _make_admin_client(db, api_client)
        resp = client.get("/api/v1/users")
        assert resp.status_code == status.HTTP_200_OK
        for key in ("count", "next", "previous", "results"):
            assert key in resp.data, f"Missing key '{key}' in pagination envelope"

    def test_last_page_has_no_next(self, db, api_client):
        client = _make_admin_client(db, api_client)
        _bulk_create_users(3, prefix="lastpg")
        resp = client.get("/api/v1/users?page_size=100")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["next"] is None


@pytest.mark.django_db
class TestRoleListNotPaginated:
    def test_roles_returns_plain_list(self, superadmin_client):
        resp = superadmin_client.get("/api/v1/roles")
        assert resp.status_code == status.HTTP_200_OK
        # Plain list, not a paginated envelope
        assert isinstance(resp.data, list), "Roles endpoint should return a plain list, not paginated"

    def test_permissions_returns_plain_list(self, superadmin_client):
        resp = superadmin_client.get("/api/v1/permissions")
        assert resp.status_code == status.HTTP_200_OK
        assert isinstance(resp.data, list), "Permissions endpoint should return a plain list, not paginated"
