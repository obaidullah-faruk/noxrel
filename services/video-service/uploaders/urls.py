from django.urls import path

from .views import UploadCompleteView, UploadInitView

urlpatterns = [
    path("init/", UploadInitView.as_view(), name="upload-init"),
    path("complete/", UploadCompleteView.as_view(), name="upload-complete"),
]
