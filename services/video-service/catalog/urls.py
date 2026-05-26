from django.urls import path

from .views import RelatedVideoView, TrendingView, VideoListView

urlpatterns = [
    path("", VideoListView.as_view(), name="video-list"),
    path("trending/", TrendingView.as_view(), name="video-trending"),
    path("<uuid:video_id>/related/", RelatedVideoView.as_view(), name="video-related"),
]
