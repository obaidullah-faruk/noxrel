from django.urls import path

from .views import MySubscriptionView, UserSubscriptionView

app_name = "subscriptions"

urlpatterns = [
    path("users/me/subscription", MySubscriptionView.as_view(), name="my-subscription"),
    path("users/<uuid:id>/subscription", UserSubscriptionView.as_view(), name="user-subscription"),
]
