from django.contrib import admin

from .models import SubscriptionTier, UserSubscription


@admin.register(SubscriptionTier)
class SubscriptionTierAdmin(admin.ModelAdmin):
    list_display = ["name", "max_quality", "simultaneous_streams", "can_download", "price_monthly_usd"]
    readonly_fields = ["id"]


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "tier", "status", "trial_start", "trial_end", "current_period_end", "created_at"]
    list_filter = ["status", "tier"]
    search_fields = ["user__email", "stripe_subscription_id"]
    readonly_fields = ["id", "created_at", "updated_at"]
