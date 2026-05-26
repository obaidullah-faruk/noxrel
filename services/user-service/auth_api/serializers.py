import structlog
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import UserProfile

from .tokens import UserRefreshToken

User = get_user_model()
logger = structlog.get_logger(__name__)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "username", "display_name", "password", "password_confirm"]

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": _("Passwords do not match.")})
        return attrs

    def create(self, validated_data: dict) -> User:
        user = User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            display_name=validated_data.get("display_name", ""),
            password=validated_data["password"],
        )
        UserProfile.objects.create(user=user)
        logger.info("user_registered", user_id=str(user.id), email=user.email)
        return user


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    token_class = UserRefreshToken

    def validate(self, attrs: dict) -> dict:
        data = super().validate(attrs)
        user = self.user

        if user.is_locked:
            raise serializers.ValidationError(_("Account is temporarily locked. Try again later."))

        if user.login_attempts > 0:
            user.login_attempts = 0
            user.save(update_fields=["login_attempts"])

        logger.info("user_logged_in", user_id=str(user.id))
        return data


class RefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs: dict) -> dict:
        try:
            token = UserRefreshToken(attrs["refresh"])
        except Exception as exc:
            raise serializers.ValidationError(_("Invalid or expired refresh token.")) from exc
        return {"access": str(token.access_token), "refresh": str(token)}


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate_refresh(self, value: str) -> str:
        try:
            RefreshToken(value)
        except Exception as exc:
            raise serializers.ValidationError(_("Invalid refresh token.")) from exc
        return value

    def save(self) -> None:
        token = RefreshToken(self.validated_data["refresh"])
        token.blacklist()
        logger.info("user_logged_out", jti=token.get("jti"))


class MeSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

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
            "profile",
        ]
        read_only_fields = fields

    def get_profile(self, obj: User) -> dict | None:
        try:
            p = obj.profile
            return {
                "bio": p.bio,
                "country_code": p.country_code,
                "preferred_language": p.preferred_language,
                "content_preferences": p.content_preferences,
            }
        except UserProfile.DoesNotExist:
            return None
