from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import OAuthConnection, User, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Profile"


class OAuthConnectionInline(admin.TabularInline):
    model = OAuthConnection
    extra = 0
    readonly_fields = ["provider", "provider_user_id", "expires_at", "created_at"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline, OAuthConnectionInline]
    list_display = [
        "email",
        "username",
        "display_name",
        "is_active",
        "is_email_verified",
        "is_staff",
        "created_at",
    ]
    list_filter = ["is_active", "is_staff", "is_email_verified"]
    search_fields = ["email", "username", "display_name"]
    ordering = ["-created_at"]
    readonly_fields = ["id", "created_at", "updated_at", "last_login_at"]

    fieldsets = (
        (None, {"fields": ("id", "email", "username", "display_name", "password")}),
        ("Personal", {"fields": ("avatar_url",)}),
        ("Security", {"fields": ("is_active", "is_staff", "is_superuser", "login_attempts", "locked_until")}),
        ("Verification", {"fields": ("is_email_verified", "email_verified_at")}),
        ("Timestamps", {"fields": ("created_at", "updated_at", "last_login_at")}),
        ("Groups / Permissions", {"fields": ("groups", "user_permissions")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "username", "display_name", "password1", "password2"),
            },
        ),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "country_code", "preferred_language", "updated_at"]
    search_fields = ["user__email", "user__username"]


@admin.register(OAuthConnection)
class OAuthConnectionAdmin(admin.ModelAdmin):
    list_display = ["user", "provider", "provider_user_id", "created_at"]
    list_filter = ["provider"]
    search_fields = ["user__email", "provider_user_id"]
    readonly_fields = ["created_at"]
