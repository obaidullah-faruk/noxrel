from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "bio",
            "country_code",
            "preferred_language",
            "content_preferences",
            "notification_preferences",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class UserDetailSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "display_name",
            "avatar_url",
            "is_active",
            "is_email_verified",
            "created_at",
            "updated_at",
            "profile",
        ]
        read_only_fields = ["id", "email", "created_at", "updated_at"]


class UpdateProfileSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ["display_name", "avatar_url", "profile"]

    def update(self, instance: User, validated_data: dict) -> User:
        profile_data = validated_data.pop("profile", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if profile_data:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        return instance


class AdminUserDetailSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "display_name",
            "avatar_url",
            "is_active",
            "is_staff",
            "is_email_verified",
            "email_verified_at",
            "last_login_at",
            "login_attempts",
            "locked_until",
            "created_at",
            "updated_at",
            "profile",
        ]
        read_only_fields = ["id", "email", "created_at", "updated_at"]


class UserRoleAssignSerializer(serializers.Serializer):
    role_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
    action = serializers.ChoiceField(choices=["add", "remove"])
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
