from datetime import timedelta

import requests as http_requests
import structlog
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import OAuthConnection, UserProfile
from core.kafka import publish

from .serializers import (
    CustomTokenObtainPairSerializer,
    LogoutSerializer,
    MeSerializer,
    RefreshTokenSerializer,
    RegisterSerializer,
    TokenPairSerializer,
)
from .tokens import UserRefreshToken

User = get_user_model()
logger = structlog.get_logger(__name__)


@extend_schema(tags=["Auth"])
class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=RegisterSerializer, responses={201: TokenPairSerializer}, summary="Register a new user")
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = UserRefreshToken.for_user(user)

        publish(
            topic="user.registered",
            payload={
                "user_id": str(user.id),
                "email": user.email,
                "username": user.username,
                "created_at": user.created_at.isoformat(),
            },
            key=str(user.id),
        )

        return Response(
            {"access": str(refresh.access_token), "refresh": str(refresh)},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Auth"])
class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(summary="Login — returns access + refresh tokens")
    def post(self, request: Request, *args, **kwargs) -> Response:
        return super().post(request, *args, **kwargs)


@extend_schema(tags=["Auth"])
class RefreshView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=RefreshTokenSerializer, responses={200: TokenPairSerializer}, summary="Rotate refresh token")
    def post(self, request: Request) -> Response:
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


@extend_schema(tags=["Auth"])
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutSerializer, responses={204: None}, summary="Logout — blacklist refresh token")
    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Auth"])
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: MeSerializer}, summary="Current authenticated user")
    def get(self, request: Request) -> Response:
        return Response(MeSerializer(request.user).data)


@extend_schema(tags=["OAuth"])
class GoogleOAuthRedirectView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(summary="Redirect URL for Google OAuth2 consent page")
    def get(self, request: Request) -> Response:

        adapter = GoogleOAuth2Adapter(request)
        callback_url = request.build_absolute_uri("/api/v1/auth/oauth/google/callback")
        client = OAuth2Client(
            request,
            settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"],
            settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["secret"],
            adapter.access_token_method,
            adapter.access_token_url,
            callback_url,
            scope=["profile", "email"],
        )
        authorize_url = client.get_redirect_url(adapter.authorize_url, ["profile", "email"])
        return Response({"redirect_url": authorize_url})


@extend_schema(tags=["OAuth"])
class GoogleOAuthCallbackView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses={200: TokenPairSerializer}, summary="Exchange Google OAuth code for JWT tokens")
    def get(self, request: Request) -> Response:
        code = request.GET.get("code")
        if not code:
            return Response({"detail": "Missing authorization code."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_data = _exchange_google_code(request, code)
            user_info = _fetch_google_user_info(token_data["access_token"])
            user = _get_or_create_oauth_user(user_info, token_data)
        except Exception as exc:
            logger.error("google_oauth_failed", error=str(exc))
            return Response({"detail": "OAuth authentication failed."}, status=status.HTTP_400_BAD_REQUEST)

        refresh = UserRefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


# ---------------------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------------------

def _exchange_google_code(request: Request, code: str) -> dict:

    app = settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]
    callback_url = request.build_absolute_uri("/api/v1/auth/oauth/google/callback")

    resp = http_requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": app["client_id"],
            "client_secret": app["secret"],
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _fetch_google_user_info(access_token: str) -> dict:

    resp = http_requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _get_or_create_oauth_user(user_info: dict, token_data: dict) -> User:

    email = user_info.get("email", "")
    provider_user_id = user_info.get("sub", "")

    conn = OAuthConnection.objects.filter(
        provider=OAuthConnection.PROVIDER_GOOGLE,
        provider_user_id=provider_user_id,
    ).select_related("user").first()

    if conn:
        return conn.user

    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": email.split("@")[0],
            "display_name": user_info.get("name", email.split("@")[0]),
            "avatar_url": user_info.get("picture", ""),
            "is_email_verified": user_info.get("email_verified", False),
        },
    )

    OAuthConnection.objects.create(
        user=user,
        provider=OAuthConnection.PROVIDER_GOOGLE,
        provider_user_id=provider_user_id,
        access_token=token_data.get("access_token", ""),
        refresh_token=token_data.get("refresh_token", ""),
        expires_at=(
            timezone.now() + timedelta(seconds=token_data["expires_in"])
            if "expires_in" in token_data else None
        ),
    )

    if created:
        UserProfile.objects.create(user=user)
        publish(
            topic="user.registered",
            payload={
                "user_id": str(user.id),
                "email": user.email,
                "username": user.username,
                "created_at": user.created_at.isoformat(),
                "via_oauth": True,
            },
            key=str(user.id),
        )

    return user
