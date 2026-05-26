from rest_framework import serializers

from .models import Permission, Role, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    codename = serializers.CharField(read_only=True)

    class Meta:
        model = Permission
        fields = ["id", "resource", "action", "codename", "description"]
        read_only_fields = ["id", "codename"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "description", "is_system", "permissions", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["name", "description"]

    def validate_name(self, value: str) -> str:
        if Role.objects.filter(name=value).exists():
            raise serializers.ValidationError("A role with this name already exists.")
        return value


class RolePermissionUpdateSerializer(serializers.Serializer):
    permission_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
    action = serializers.ChoiceField(choices=["add", "remove"])


class UserRoleSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)

    class Meta:
        model = UserRole
        fields = ["id", "role", "granted_by", "granted_at", "expires_at"]
        read_only_fields = fields
