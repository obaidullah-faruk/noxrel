from rest_framework import serializers

from .models import SubscriptionTier, UserSubscription


class SubscriptionTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionTier
        fields = ["id", "name", "max_quality", "simultaneous_streams", "can_download", "price_monthly_usd"]
        read_only_fields = fields


class UserSubscriptionSerializer(serializers.ModelSerializer):
    tier = SubscriptionTierSerializer(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            "id", "tier", "status", "trial_start", "trial_end",
            "current_period_start", "current_period_end",
            "cancel_at_period_end", "cancelled_at", "created_at",
        ]
        read_only_fields = fields
