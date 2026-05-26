"""
Create a superadmin user for local development. Idempotent.
Credentials come from settings (DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD).
Default: admin@admin.com / admin1234
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from roles.models import Role, UserRole

User = get_user_model()


class Command(BaseCommand):
    help = "Create dev superadmin user (idempotent)"

    def handle(self, *args, **options) -> None:
        email = settings.DEV_ADMIN_EMAIL
        username = settings.DEV_ADMIN_USERNAME
        password = settings.DEV_ADMIN_PASSWORD

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "display_name": "Dev Admin",
                "is_staff": True,
                "is_superuser": True,
                "is_email_verified": True,
            },
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created dev admin: {email} / {password}"))
        else:
            self.stdout.write(f"Dev admin already exists: {email}")

        try:
            role = Role.objects.get(name="superadmin")
            UserRole.objects.get_or_create(user=user, role=role)
            self.stdout.write("Superadmin RBAC role assigned.")
        except Role.DoesNotExist:
            self.stdout.write(self.style.WARNING("'superadmin' role not found — run seed_rbac first."))
