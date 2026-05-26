import structlog
from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = structlog.get_logger(__name__)


def custom_exception_handler(exc: Exception, context: dict) -> Response | None:
    response = exception_handler(exc, context)

    if isinstance(exc, Http404):
        response = Response({"detail": "Not found.", "code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
    elif isinstance(exc, PermissionDenied):
        response = Response(
            {"detail": "Permission denied.", "code": "permission_denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if response is not None and isinstance(exc, APIException):
        logger.warning("api_exception", detail=str(exc.detail), status=exc.status_code)
        data = response.data
        if not isinstance(data, dict) or "detail" not in data:
            response.data = {"detail": data, "code": "error"}

    if response is None:
        logger.exception("unhandled_exception", exc_info=exc)

    return response


class ServiceUnavailableError(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Service temporarily unavailable."
    default_code = "service_unavailable"


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Resource conflict."
    default_code = "conflict"
