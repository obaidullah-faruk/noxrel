import structlog
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminRole, invalidate_user_rbac_cache
from roles.models import Role, UserRole

from .serializers import (
    AdminUserDetailSerializer,
    UpdateProfileSerializer,
    UserDetailSerializer,
    UserRoleAssignSerializer,
)

User = get_user_model()
logger = structlog.get_logger(__name__)


@extend_schema(tags=["Users"])
class MeDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdateProfileSerializer
        return UserDetailSerializer

    def get_object(self):
        return self.request.user

    @extend_schema(summary="Get own profile")
    def get(self, request: Request, *args, **kwargs) -> Response:
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Update own profile")
    def patch(self, request: Request, *args, **kwargs) -> Response:
        return super().partial_update(request, *args, **kwargs)


@extend_schema(tags=["Admin — Users"])
class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = AdminUserDetailSerializer
    queryset = User.objects.select_related("profile").all()
    lookup_field = "id"

    @extend_schema(summary="[Admin] Get any user's profile")
    def get(self, request: Request, *args, **kwargs) -> Response:
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="[Admin] Update any user")
    def patch(self, request: Request, *args, **kwargs) -> Response:
        return super().partial_update(request, *args, **kwargs)


@extend_schema(tags=["Admin — Users"])
class AdminUserRolesView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    @extend_schema(
        request=UserRoleAssignSerializer,
        responses={200: AdminUserDetailSerializer},
        summary="[Admin] Assign or remove roles on a user",
    )
    def patch(self, request: Request, id: str) -> Response:
        try:
            user = User.objects.get(id=id)
        except User.DoesNotExist:
            raise NotFound("User not found.")

        serializer = UserRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data["action"]
        role_ids = serializer.validated_data["role_ids"]
        expires_at = serializer.validated_data.get("expires_at")

        roles = Role.objects.filter(id__in=role_ids)
        if roles.count() != len(role_ids):
            return Response({"detail": "One or more role IDs not found."}, status=status.HTTP_400_BAD_REQUEST)

        if action == "add":
            for role in roles:
                UserRole.objects.update_or_create(
                    user=user, role=role,
                    defaults={"granted_by": request.user, "expires_at": expires_at},
                )
        else:
            UserRole.objects.filter(user=user, role__in=roles).delete()

        invalidate_user_rbac_cache(str(user.id))
        logger.info("user_roles_updated", user_id=str(user.id), action=action)
        return Response(AdminUserDetailSerializer(user).data)
