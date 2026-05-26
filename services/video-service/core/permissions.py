import structlog
from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

logger = structlog.get_logger(__name__)

# Header names forwarded by the API Gateway after JWT validation
HEADER_USER_ID = "HTTP_X_USER_ID"
HEADER_ROLES = "HTTP_X_USER_ROLES"
HEADER_PERMISSIONS = "HTTP_X_USER_PERMISSIONS"


def get_gateway_user_id(request: Request) -> str | None:
    """Extract user_id forwarded by API Gateway."""
    return request.META.get(HEADER_USER_ID)


def get_gateway_permissions(request: Request) -> list[str]:
    """Extract comma-separated permissions forwarded by API Gateway."""
    raw = request.META.get(HEADER_PERMISSIONS, "")
    return [p.strip() for p in raw.split(",") if p.strip()]


class HasGatewayPermission(BasePermission):
    """
    Checks permission forwarded in X-User-Permissions header by the API Gateway.
    Usage: permission_classes = [require_permission("video:watch")]
    """

    required_permission: str = ""

    def has_permission(self, request: Request, view: APIView) -> bool:
        user_id = get_gateway_user_id(request)
        if not user_id:
            return False
        permissions = get_gateway_permissions(request)
        allowed = self.required_permission in permissions
        if not allowed:
            logger.warning("rbac_denied", user_id=user_id, required=self.required_permission)
        return allowed


def require_permission(permission: str) -> type:
    """Factory returning a HasGatewayPermission subclass for a specific permission."""
    return type(
        f"HasPermission_{permission.replace(':', '_')}",
        (HasGatewayPermission,),
        {"required_permission": permission},
    )


class IsInternalCall(BasePermission):
    """Allow requests from internal services (no JWT, just X-Internal-Key header)."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        key = request.headers.get("X-Internal-Key", "")
        return key == getattr(settings, "INTERNAL_API_KEY", "")
