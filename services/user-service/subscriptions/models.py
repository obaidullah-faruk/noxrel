import uuid

from django.conf import settings
from django.db import models


class SubscriptionTier(models.Model):
    FREE_TRIAL = "free_trial"
    BASIC = "basic"
    PREMIUM = "premium"
    TIER_CHOICES = [(FREE_TRIAL, "Free Trial"), (BASIC, "Basic"), (PREMIUM, "Premium")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True, choices=TIER_CHOICES)
    max_quality = models.CharField(max_length=8)
    simultaneous_streams = models.PositiveSmallIntegerField(default=1)
    can_download = models.BooleanField(default=False)
    price_monthly_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "subscription_tiers"

    def __str__(self) -> str:
        return self.name


class UserSubscription(models.Model):
    STATUS_TRIALING = "trialing"
    STATUS_ACTIVE = "active"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELLED = "cancelled"
    STATUS_PAUSED = "paused"
    STATUS_INCOMPLETE = "incomplete"
    STATUS_CHOICES = [
        (STATUS_TRIALING, "Trialing"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAST_DUE, "Past Due"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_INCOMPLETE, "Incomplete"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions")
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, db_index=True)
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    stripe_subscription_id = models.CharField(max_length=128, blank=True, db_index=True)
    cancel_at_period_end = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_subscriptions"
        indexes = [
            models.Index(fields=["user"]),
            models.Index(
                fields=["trial_end"],
                condition=models.Q(status="trialing"),
                name="idx_subscriptions_trial_end",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} — {self.tier.name} ({self.status})"

    @property
    def is_trial(self) -> bool:
        return self.status == self.STATUS_TRIALING
