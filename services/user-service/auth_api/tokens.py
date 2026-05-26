from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from core.permissions import get_user_permissions


class UserRefreshToken(RefreshToken):
    """Extends simplejwt RefreshToken to embed roles, permissions, and trial data in the access token."""

    @classmethod
    def for_user(cls, user) -> "UserRefreshToken":
        token = super().for_user(user)
        token._enrich_access(user)
        return token

    def _enrich_access(self, user) -> None:
        rbac = get_user_permissions(str(user.id))
        trial_ends_at = _get_trial_end(user)

        access = self.access_token
        access["email"] = user.email
        access["username"] = user.username
        access["roles"] = rbac.get("roles", [])
        access["permissions"] = rbac.get("permissions", [])
        access["trial_ends_at"] = trial_ends_at.isoformat() if trial_ends_at else None


def _get_trial_end(user):
    try:
        from subscriptions.models import UserSubscription
        sub = (
            UserSubscription.objects
            .filter(user=user, status=UserSubscription.STATUS_TRIALING)
            .order_by("-created_at")
            .first()
        )
        if sub and sub.trial_end and sub.trial_end > timezone.now():
            return sub.trial_end
    except Exception:
        pass
    return None
