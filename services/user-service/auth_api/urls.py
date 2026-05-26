from django.urls import path

from .views import (
    GoogleOAuthCallbackView,
    GoogleOAuthRedirectView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
)

app_name = "auth_api"

urlpatterns = [
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/refresh", RefreshView.as_view(), name="refresh"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/me", MeView.as_view(), name="me"),
    path("auth/oauth/google", GoogleOAuthRedirectView.as_view(), name="google-oauth"),
    path("auth/oauth/google/callback", GoogleOAuthCallbackView.as_view(), name="google-callback"),
]
