import structlog
from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

logger = structlog.get_logger(__name__)


def get_user_permissions(user_id: str) -> dict:
    """Return {roles, permissions} for a user. Redis-cached with 60s TTL."""
    cache_key = f"rbac:{user_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    from roles.models import UserRole  # local import avoids circular dependency

    qs = (
        UserRole.objects.filter(user_id=user_id, expires_at__isnull=True)
        .select_related("role")
        .prefetch_related("role__permissions")
    )

    roles = []
    permissions = set()
    for user_role in qs:
        roles.append(user_role.role.name)
        for perm in user_role.role.permissions.all():
            permissions.add(f"{perm.resource}:{perm.action}")

    result = {"roles": roles, "permissions": list(permissions)}
    cache.set(cache_key, result, timeout=settings.RBAC_CACHE_TTL)
    return result


def invalidate_user_rbac_cache(user_id: str) -> None:
    cache.delete(f"rbac:{user_id}")


class HasPermission(BasePermission):
    """
    Usage:  permission_classes = [HasPermission("video:watch")]
    Subclass via require_permission() factory or override required_permission.
    """

    required_permission: str = ""

    def has_permission(self, request: Request, view: APIView) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        rbac = get_user_permissions(str(request.user.id))
        allowed = self.required_permission in rbac.get("permissions", [])
        if not allowed:
            logger.warning(
                "rbac_denied",
                user_id=str(request.user.id),
                required=self.required_permission,
            )
        return allowed


def require_permission(permission: str) -> type:
    """Factory returning a HasPermission subclass for a specific permission codename."""
    return type(
        f"HasPermission_{permission.replace(':', '_')}",
        (HasPermission,),
        {"required_permission": permission},
    )


class IsAdminRole(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        rbac = get_user_permissions(str(request.user.id))
        return bool({"admin", "superadmin"} & set(rbac.get("roles", [])))


class IsSuperAdmin(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        rbac = get_user_permissions(str(request.user.id))
        return "superadmin" in rbac.get("roles", [])
