from django.contrib import admin

from .models import Permission, Role, RolePermission, UserRole


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0
    autocomplete_fields = ["permission"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "is_system", "created_at"]
    list_filter = ["is_system"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at"]
    inlines = [RolePermissionInline]

    def has_delete_permission(self, request, obj=None):
        if obj and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["resource", "action", "description"]
    list_filter = ["resource"]
    search_fields = ["resource", "action"]
    readonly_fields = ["id"]


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ["user", "role", "granted_by", "granted_at", "expires_at"]
    list_filter = ["role"]
    search_fields = ["user__email", "role__name"]
    readonly_fields = ["id", "granted_at"]
