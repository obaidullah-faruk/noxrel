"""RBAC tests: role assignment, permission enforcement."""
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestRoleEndpoints:
    def test_list_roles_requires_admin(self, auth_client):
        resp = auth_client.get("/api/v1/roles")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_list_roles_as_superadmin(self, superadmin_client):
        resp = superadmin_client.get("/api/v1/roles")
        assert resp.status_code == status.HTTP_200_OK

    def test_create_role_as_superadmin(self, superadmin_client):
        resp = superadmin_client.post(
            "/api/v1/roles/create",
            {"name": "custom_editor", "description": "Custom editor role"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data["name"] == "custom_editor"

    def test_create_role_duplicate_name(self, superadmin_client):
        superadmin_client.post("/api/v1/roles/create", {"name": "unique_role"}, format="json")
        resp = superadmin_client.post("/api/v1/roles/create", {"name": "unique_role"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_role_requires_superadmin(self, auth_client):
        resp = auth_client.post("/api/v1/roles/create", {"name": "hacker_role"}, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestUserRoleAssignment:
    def test_assign_role_to_user(self, superadmin_client, registered_user):
        from roles.models import Role
        role, _ = Role.objects.get_or_create(name="test_role", defaults={"description": "Test"})
        resp = superadmin_client.patch(
            f"/api/v1/users/{registered_user.id}/roles",
            {"role_ids": [str(role.id)], "action": "add"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK

    def test_remove_role_from_user(self, superadmin_client, registered_user):
        from roles.models import Role, UserRole
        role, _ = Role.objects.get_or_create(name="temp_role", defaults={"description": "Temp"})
        UserRole.objects.get_or_create(user=registered_user, role=role)

        resp = superadmin_client.patch(
            f"/api/v1/users/{registered_user.id}/roles",
            {"role_ids": [str(role.id)], "action": "remove"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert not registered_user.user_roles.filter(role=role).exists()
