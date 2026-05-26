"""Cron job: downgrade expired free trials to the guest role. Run daily."""

import structlog
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.kafka import flush, publish
from core.permissions import invalidate_user_rbac_cache
from roles.models import Role, UserRole
from subscriptions.models import UserSubscription

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Expire free trials that have passed their trial_end date"

    def handle(self, *args, **options) -> None:
        now = timezone.now()
        expired = UserSubscription.objects.filter(
            status=UserSubscription.STATUS_TRIALING,
            trial_end__lt=now,
            stripe_subscription_id="",
        ).select_related("user")

        count = expired.count()
        self.stdout.write(f"Found {count} expired trial(s).")

        try:
            guest_role = Role.objects.get(name="guest")
            trial_role = Role.objects.get(name="free_trial")
        except Role.DoesNotExist:
            self.stderr.write("Built-in roles not found. Run seed_rbac first.")
            return

        for sub in expired:
            user = sub.user
            sub.status = UserSubscription.STATUS_CANCELLED
            sub.cancelled_at = now
            sub.save(update_fields=["status", "cancelled_at"])

            UserRole.objects.filter(user=user, role=trial_role).delete()
            UserRole.objects.get_or_create(user=user, role=guest_role)
            invalidate_user_rbac_cache(str(user.id))

            publish(
                topic="user.trial_expired",
                payload={"user_id": str(user.id), "email": user.email, "expired_at": now.isoformat()},
                key=str(user.id),
            )
            logger.info("trial_expired", user_id=str(user.id))

        flush()
        self.stdout.write(self.style.SUCCESS(f"Expired {count} trial(s)."))
