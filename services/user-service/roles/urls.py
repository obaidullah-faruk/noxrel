from django.urls import path

from .views import PermissionListView, RoleCreateView, RoleListView, RolePermissionUpdateView

app_name = "roles"

urlpatterns = [
    path("roles", RoleListView.as_view(), name="role-list"),
    path("roles/create", RoleCreateView.as_view(), name="role-create"),
    path("roles/<uuid:id>/permissions", RolePermissionUpdateView.as_view(), name="role-permissions"),
    path("permissions", PermissionListView.as_view(), name="permission-list"),
]
