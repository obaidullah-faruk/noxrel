from django.urls import path

from .internal_views import InternalVideoDetailView

urlpatterns = [
    path("videos/<uuid:video_id>/", InternalVideoDetailView.as_view(), name="internal-video-detail"),
]
