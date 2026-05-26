"""Integration tests: register → login → protected endpoint → refresh → logout."""
from unittest.mock import patch

import pytest
from rest_framework import status


@pytest.mark.django_db
class TestRegister:
    def test_register_success(self, api_client, user_data):
        with patch("auth_api.views.publish"):
            resp = api_client.post("/api/v1/auth/register", user_data, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        assert "access" in resp.data and "refresh" in resp.data

    def test_register_duplicate_email(self, api_client, registered_user, user_data):
        with patch("auth_api.views.publish"):
            resp = api_client.post("/api/v1/auth/register", user_data, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_password_mismatch(self, api_client, user_data):
        user_data["password_confirm"] = "WrongPassword1!"
        resp = api_client.post("/api/v1/auth/register", user_data, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_weak_password(self, api_client, user_data):
        user_data["password"] = user_data["password_confirm"] = "123"
        resp = api_client.post("/api/v1/auth/register", user_data, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    def test_login_success(self, api_client, registered_user, user_data):
        resp = api_client.post(
            "/api/v1/auth/login",
            {"email": user_data["email"], "password": user_data["password"]},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data and "refresh" in resp.data

    def test_login_wrong_password(self, api_client, registered_user, user_data):
        resp = api_client.post(
            "/api/v1/auth/login",
            {"email": user_data["email"], "password": "WrongPassword!"},
            format="json",
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_unknown_email(self, api_client):
        resp = api_client.post(
            "/api/v1/auth/login",
            {"email": "nobody@example.com", "password": "any"},
            format="json",
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestProtectedEndpoints:
    def test_me_authenticated(self, auth_client, registered_user):
        resp = auth_client.get("/api/v1/auth/me")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["email"] == registered_user.email

    def test_me_unauthenticated(self, api_client):
        resp = api_client.get("/api/v1/auth/me")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_users_me_get(self, auth_client, registered_user):
        resp = auth_client.get("/api/v1/users/me")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["username"] == registered_user.username

    def test_users_me_patch(self, auth_client):
        resp = auth_client.patch(
            "/api/v1/users/me", {"display_name": "Updated Name"}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["display_name"] == "Updated Name"


@pytest.mark.django_db
class TestTokenRefresh:
    def test_refresh_returns_new_tokens(self, api_client, registered_user):
        from auth_api.tokens import UserRefreshToken
        refresh = UserRefreshToken.for_user(registered_user)
        resp = api_client.post("/api/v1/auth/refresh", {"refresh": str(refresh)}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data and "refresh" in resp.data

    def test_refresh_invalid_token(self, api_client):
        resp = api_client.post("/api/v1/auth/refresh", {"refresh": "not.valid"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogout:
    def test_logout_blacklists_token(self, api_client, registered_user):
        from auth_api.tokens import UserRefreshToken
        refresh = UserRefreshToken.for_user(registered_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
        resp = api_client.post("/api/v1/auth/logout", {"refresh": str(refresh)}, format="json")
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    def test_logout_requires_auth(self, api_client, registered_user):
        from auth_api.tokens import UserRefreshToken
        refresh = UserRefreshToken.for_user(registered_user)
        resp = api_client.post("/api/v1/auth/logout", {"refresh": str(refresh)}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestHealth:
    def test_health_endpoint(self, api_client):
        resp = api_client.get("/health")
        assert resp.status_code in (status.HTTP_200_OK, status.HTTP_503_SERVICE_UNAVAILABLE)
        assert "status" in resp.data
