from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from core.permissions import get_user_permissions


class UserRefreshToken(RefreshToken):
    """
    Extends simplejwt RefreshToken to embed roles, permissions, and profile
    data in both the refresh token payload and the derived access token.

    simplejwt's `access_token` property copies all claims from the refresh
    token payload except those in `no_copy_claims` (token_type, exp, jti,
    iat). Setting custom claims on `self` here ensures they are automatically
    propagated to the access token without a second DB round-trip.
    """

    @classmethod
    def for_user(cls, user) -> "UserRefreshToken":
        token = super().for_user(user)
        token._embed_claims(user)
        return token

    def _embed_claims(self, user) -> None:
        rbac = get_user_permissions(str(user.id))
        trial_ends_at = _get_trial_end(user)

        # Set on self — these propagate to access_token via payload copy.
        self["email"] = user.email
        self["username"] = user.username
        self["roles"] = rbac.get("roles", [])
        self["permissions"] = rbac.get("permissions", [])
        self["trial_ends_at"] = trial_ends_at.isoformat() if trial_ends_at else None


def _get_trial_end(user):
    try:
        from subscriptions.models import UserSubscription

        sub = (
            UserSubscription.objects.filter(user=user, status=UserSubscription.STATUS_TRIALING)
            .order_by("-created_at")
            .first()
        )
        if sub and sub.trial_end and sub.trial_end > timezone.now():
            return sub.trial_end
    except Exception:
        pass
    return None
