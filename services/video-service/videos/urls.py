from django.urls import path

from .views import VideoDetailView, VideoPublishView

urlpatterns = [
    path("<uuid:video_id>/", VideoDetailView.as_view(), name="video-detail"),
    path("<uuid:video_id>/publish/", VideoPublishView.as_view(), name="video-publish"),
]
