import structlog
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminRole, IsSuperAdmin, invalidate_user_rbac_cache

from .models import Permission, Role, UserRole
from .serializers import (
    PermissionSerializer,
    RoleCreateSerializer,
    RolePermissionUpdateSerializer,
    RoleSerializer,
)

logger = structlog.get_logger(__name__)


@extend_schema(tags=["Roles"])
class RoleListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = RoleSerializer
    queryset = Role.objects.prefetch_related("permissions").all()
    pagination_class = None

    @extend_schema(summary="[Admin] List all roles")
    def get(self, request: Request, *args, **kwargs) -> Response:
        return super().get(request, *args, **kwargs)


@extend_schema(tags=["Roles"])
class RoleCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class = RoleCreateSerializer

    @extend_schema(summary="[Superadmin] Create a new role")
    def post(self, request: Request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        logger.info("role_created", role_id=str(role.id), name=role.name)
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Roles"])
class RolePermissionUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        request=RolePermissionUpdateSerializer,
        responses={200: RoleSerializer},
        summary="[Superadmin] Add or remove permissions on a role",
    )
    def patch(self, request: Request, id: str) -> Response:
        try:
            role = Role.objects.prefetch_related("permissions").get(id=id)
        except Role.DoesNotExist:
            raise NotFound("Role not found.")

        serializer = RolePermissionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        perm_ids = serializer.validated_data["permission_ids"]
        action = serializer.validated_data["action"]

        permissions = Permission.objects.filter(id__in=perm_ids)
        if permissions.count() != len(perm_ids):
            return Response({"detail": "One or more permission IDs not found."}, status=status.HTTP_400_BAD_REQUEST)

        if action == "add":
            role.permissions.add(*permissions)
        else:
            role.permissions.remove(*permissions)

        # Invalidate RBAC cache for all users who hold this role
        user_ids = UserRole.objects.filter(role=role).values_list("user_id", flat=True)
        for uid in user_ids:
            invalidate_user_rbac_cache(str(uid))

        logger.info("role_permissions_updated", role_id=str(role.id), action=action)
        return Response(RoleSerializer(role).data)


@extend_schema(tags=["Roles"])
class PermissionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = PermissionSerializer
    queryset = Permission.objects.all()
    pagination_class = None

    @extend_schema(summary="[Admin] List all permissions")
    def get(self, request: Request, *args, **kwargs) -> Response:
        return super().get(request, *args, **kwargs)
