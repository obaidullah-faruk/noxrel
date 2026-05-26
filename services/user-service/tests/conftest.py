import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient
from auth_api import views as auth_views
from auth_api.tokens import UserRefreshToken
from roles.models import Role, UserRole
from auth_api.tokens import UserRefreshToken

User = get_user_model()


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    with django_db_blocker.unblock():
        call_command("seed_rbac")


@pytest.fixture(autouse=True)
def disable_throttling(settings, monkeypatch):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {},
    }
    monkeypatch.setattr(auth_views.RegisterView, "throttle_classes", [])
    monkeypatch.setattr(auth_views.LoginView, "throttle_classes", [])


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_data():
    return {
        "email": "testuser@example.com",
        "username": "testuser",
        "display_name": "Test User",
        "password": "StrongP@ssw0rd!",
        "password_confirm": "StrongP@ssw0rd!",
    }


@pytest.fixture
def registered_user(db, user_data):
    return User.objects.create_user(
        email=user_data["email"],
        username=user_data["username"],
        display_name=user_data["display_name"],
        password=user_data["password"],
    )


@pytest.fixture
def auth_client(db, api_client, registered_user):
    refresh = UserRefreshToken.for_user(registered_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client


@pytest.fixture
def superadmin_user(db):
    user = User.objects.create_superuser(
        email="superadmin@example.com",
        username="superadmin",
        display_name="Super Admin",
        password="SuperAdminP@ss1!",
    )
    role = Role.objects.get(name="superadmin")
    UserRole.objects.get_or_create(user=user, role=role)
    return user


@pytest.fixture
def superadmin_client(db, api_client, superadmin_user):
    refresh = UserRefreshToken.for_user(superadmin_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return api_client
