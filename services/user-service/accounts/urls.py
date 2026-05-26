from django.urls import path

from .views import AdminUserDetailView, AdminUserRolesView, MeDetailView

app_name = "accounts"

urlpatterns = [
    path("users/me", MeDetailView.as_view(), name="me-detail"),
    path("users/<uuid:id>", AdminUserDetailView.as_view(), name="user-detail"),
    path("users/<uuid:id>/roles", AdminUserRolesView.as_view(), name="user-roles"),
]
