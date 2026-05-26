from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.permissions import IsAdminRole
from .models import UserSubscription
from .serializers import UserSubscriptionSerializer


@extend_schema(tags=["Subscriptions"])
class MySubscriptionView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSubscriptionSerializer

    def get_object(self) -> UserSubscription:
        sub = (
            UserSubscription.objects
            .filter(user=self.request.user)
            .select_related("tier")
            .order_by("-created_at")
            .first()
        )
        if not sub:
            raise NotFound("No subscription found.")
        return sub

    @extend_schema(summary="Get own subscription status")
    def get(self, request: Request, *args, **kwargs) -> Response:
        return super().get(request, *args, **kwargs)


@extend_schema(tags=["Admin — Subscriptions"])
class UserSubscriptionView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = UserSubscriptionSerializer

    def get_object(self) -> UserSubscription:
        sub = (
            UserSubscription.objects
            .filter(user_id=self.kwargs["id"])
            .select_related("tier")
            .order_by("-created_at")
            .first()
        )
        if not sub:
            raise NotFound("No subscription found for this user.")
        return sub

    @extend_schema(summary="[Admin] Get any user's subscription")
    def get(self, request: Request, *args, **kwargs) -> Response:
        return super().get(request, *args, **kwargs)
