from django.urls import path

from .internal_views import FromLiveView, InternalVideoDetailView

urlpatterns = [
    path("videos/from_live", FromLiveView.as_view(), name="internal-video-from-live"),
    path("videos/<uuid:video_id>/", InternalVideoDetailView.as_view(), name="internal-video-detail"),
]
