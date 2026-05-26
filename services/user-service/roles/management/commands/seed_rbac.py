"""Seed built-in roles and permissions. Idempotent — safe to re-run."""

from django.core.management.base import BaseCommand

from roles.models import Permission, Role, RolePermission

PERMISSIONS = [
    ("video", "upload"),
    ("video", "delete"),
    ("video", "publish"),
    ("video", "watch"),
    ("user", "view"),
    ("user", "update"),
    ("user", "ban"),
    ("user", "delete"),
    ("comment", "create"),
    ("comment", "delete"),
    ("comment", "moderate"),
    ("live", "start"),
    ("live", "stop"),
    ("admin", "access"),
    ("billing", "manage"),
]

ROLES = {
    "superadmin": {"description": "Full access to everything", "is_system": True, "permissions": None},
    "admin": {
        "description": "Full access except billing",
        "is_system": True,
        "permissions": [p for p in PERMISSIONS if p != ("billing", "manage")],
    },
    "moderator": {
        "description": "Content moderation",
        "is_system": True,
        "permissions": [("comment", "moderate"), ("user", "ban"), ("video", "delete")],
    },
    "premium_subscriber": {
        "description": "4K streaming + comments",
        "is_system": True,
        "permissions": [("video", "watch"), ("comment", "create")],
    },
    "basic_subscriber": {
        "description": "1080p streaming + comments",
        "is_system": True,
        "permissions": [("video", "watch"), ("comment", "create")],
    },
    "free_trial": {
        "description": "480p streaming + comments",
        "is_system": True,
        "permissions": [("video", "watch"), ("comment", "create")],
    },
    "guest": {"description": "240p streaming only", "is_system": True, "permissions": [("video", "watch")]},
}


class Command(BaseCommand):
    help = "Seed built-in roles and permissions (idempotent)"

    def handle(self, *args, **options) -> None:
        self.stdout.write("Seeding permissions...")
        perm_map: dict[tuple, Permission] = {}
        for resource, action in PERMISSIONS:
            perm, created = Permission.objects.get_or_create(
                resource=resource,
                action=action,
                defaults={"description": f"{resource}:{action}"},
            )
            perm_map[(resource, action)] = perm
            self.stdout.write(f"  {'created' if created else 'exists':8s}  {resource}:{action}")

        self.stdout.write("Seeding roles...")
        for role_name, cfg in ROLES.items():
            role, created = Role.objects.get_or_create(
                name=role_name,
                defaults={"description": cfg["description"], "is_system": cfg["is_system"]},
            )
            self.stdout.write(f"  {'created' if created else 'exists':8s}  {role_name}")

            target_perms = (
                list(perm_map.values())
                if cfg["permissions"] is None
                else [perm_map[k] for k in cfg["permissions"] if k in perm_map]
            )
            for perm in target_perms:
                RolePermission.objects.get_or_create(role=role, permission=perm)

        self.stdout.write(self.style.SUCCESS("RBAC seed complete."))
