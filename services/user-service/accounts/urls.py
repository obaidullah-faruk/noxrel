from django.urls import path

from .views import AdminUserDetailView, AdminUserListView, AdminUserRolesView, MeDetailView

app_name = "accounts"

urlpatterns = [
    path("users/me", MeDetailView.as_view(), name="me-detail"),
    path("users", AdminUserListView.as_view(), name="user-list"),
    path("users/<uuid:id>", AdminUserDetailView.as_view(), name="user-detail"),
    path("users/<uuid:id>/roles", AdminUserRolesView.as_view(), name="user-roles"),
]
