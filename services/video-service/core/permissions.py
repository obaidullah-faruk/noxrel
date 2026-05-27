import structlog
from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from core.authentication import JWTUser

logger = structlog.get_logger(__name__)

HEADER_INTERNAL_KEY = "HTTP_X_INTERNAL_KEY"


class IsJWTAuthenticated(BasePermission):
    """Allow any request that carries a valid, verified JWT."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(request.user and request.user.is_authenticated)


class IsAdminJWT(BasePermission):
    """Allow only JWT bearers whose token claims include the admin or superadmin role."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        has_role = getattr(user, "has_role", None)
        if not callable(has_role):
            return False
        return isinstance(user, JWTUser) and user.has_role("admin", "superadmin")


class RequirePermission(BasePermission):
    """
    Checks that the JWT bearer has a specific permission claim.

    Subclass or use the `require_permission` factory — do not instantiate directly.
    """

    required_permission: str = ""

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        has_permission = getattr(user, "has_permission", None)
        if not callable(has_permission):
            return False
        if not isinstance(user, JWTUser):
            return False
        allowed = user.has_permission(self.required_permission)
        if not allowed:
            logger.warning(
                "rbac_denied",
                user_id=getattr(user, "id", None),
                required=self.required_permission,
            )
        return allowed


def require_permission(permission: str) -> type:
    """Factory: returns a RequirePermission subclass locked to `permission`."""
    return type(
        f"RequirePermission_{permission.replace(':', '_')}",
        (RequirePermission,),
        {"required_permission": permission},
    )


class IsInternalCall(BasePermission):
    """Allow requests from internal services identified by X-Internal-Key header."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        key = request.META.get(HEADER_INTERNAL_KEY, "")
        return bool(key and key == getattr(settings, "INTERNAL_API_KEY", ""))
