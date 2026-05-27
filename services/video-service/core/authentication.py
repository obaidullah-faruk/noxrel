from dataclasses import dataclass, field

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import Token


@dataclass
class JWTUser:
    """Lightweight user object built from JWT claims — no DB lookup.

    The video-service is a downstream verifier. It holds no user table;
    all identity and RBAC data come from claims embedded by the user-service.
    """

    id: str
    roles: list = field(default_factory=list)
    permissions: list = field(default_factory=list)
    is_authenticated: bool = True
    is_active: bool = True

    def has_role(self, *roles: str) -> bool:
        return bool(set(roles) & set(self.roles))

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions


class JWTVerifyOnlyAuthentication(JWTAuthentication):
    """
    Validates the RS256 JWT signature and expiry, then builds a JWTUser
    from the embedded claims without touching the database.

    On a missing Authorization header: returns None (anonymous request).
    On a present but invalid/expired token: raises AuthenticationFailed (401).
    """

    def get_user(self, validated_token: Token) -> JWTUser:  # type: ignore[override]
        user_id = validated_token.get("sub") or validated_token.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Token missing subject claim.")
        return JWTUser(
            id=str(user_id),
            roles=validated_token.get("roles", []),
            permissions=validated_token.get("permissions", []),
        )

    def authenticate(self, request: Request):
        header = self.get_header(request)
        if header is None:
            return None  # no credentials → anonymous, let permission class decide

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except (InvalidToken, TokenError) as exc:
            raise AuthenticationFailed(str(exc)) from exc  # 401, not silent

        return self.get_user(validated_token), validated_token


class GatewayHeaderAuthentication(BaseAuthentication):
    """
    Authenticates requests using headers injected by the API gateway.

    Only enabled in test_settings — production always goes through the JWT path.
    Headers: X-User-Id, X-User-Roles (comma-separated), X-User-Permissions (comma-separated).
    """

    def authenticate(self, request: Request):
        user_id = request.META.get("HTTP_X_USER_ID")
        if not user_id:
            return None
        roles = [r for r in request.META.get("HTTP_X_USER_ROLES", "").split(",") if r]
        permissions = [p for p in request.META.get("HTTP_X_USER_PERMISSIONS", "").split(",") if p]
        user = JWTUser(id=user_id, roles=roles, permissions=permissions)
        return user, None
