from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="dev-secret-key-change-in-production")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "django_filters",
]

LOCAL_APPS = [
    "videos",
    "uploaders",
    "catalog",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.RequestLoggingMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="video_service"),
        "USER": config("DB_USER", default="postgres"),
        "PASSWORD": config("DB_PASSWORD", default="postgres"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"connect_timeout": 10},
    }
}

# ---------------------------------------------------------------------------
# Cache (Redis) — db index 1 to not collide with user-service (index 0)
# ---------------------------------------------------------------------------

REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/1")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
        },
        "KEY_PREFIX": "video_svc",
    }
}

# ---------------------------------------------------------------------------
# JWT — video-service only VERIFIES tokens, never issues them.
# The public key must match the User Service's private key.
# ---------------------------------------------------------------------------

_DEFAULT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkc/Qf9ZM0Vc6fCfqxQSi
rAfXRfuRbHwWflmnZPHEc9LALftZ3G+1NfnFtZgkIrHbc5bPzryEJgLrDO+7hbF3
6tfiF1aaCc62HNgwFx0dJN8zNtIx6edZc5pQ9hcO68NZvzN/fI3PJeXah9JHZ+eI
SDc4/5JUZGXy0utx9Id9RESZb360fLBMG1OmdPZQ9x/Alb7fkLsKJRWfSUW0EWBO
/wH5sBmi31zx8RgEbUXNLAG07HbxrtT4jty2Vf9p43NSqjGNUIxYVUVq7BNwQMPQ
cxFBTxhSLveOj1TvNXK1dwo3PCeQNuK6IqepDG1j6xqWfGPGFmZL9P013qut1qXr
sQIDAQAB
-----END PUBLIC KEY-----"""


def _get_jwt_key(env_var: str, default: str) -> str:
    value = config(env_var, default="").strip()
    if value:
        return value.replace("\\n", "\n")
    return default


SIMPLE_JWT = {
    "ALGORITHM": "RS256",
    "VERIFYING_KEY": _get_jwt_key("JWT_PUBLIC_KEY", _DEFAULT_PUBLIC_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
}

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.JWTVerifyOnlyAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
}

# ---------------------------------------------------------------------------
# drf-spectacular
# ---------------------------------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "Video Service API",
    "DESCRIPTION": "Video upload, catalog, and transcode orchestration.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
}

# ---------------------------------------------------------------------------
# S3 / LocalStack
# ---------------------------------------------------------------------------

AWS_REGION = config("AWS_REGION", default="us-east-1")
AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="test")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="test")
# Set to http://localstack:4566 for local dev; empty string uses real AWS
AWS_S3_ENDPOINT_URL = config("AWS_S3_ENDPOINT_URL", default="")
S3_RAW_BUCKET = config("S3_RAW_BUCKET", default="raw-videos")
S3_TRANSCODED_BUCKET = config("S3_TRANSCODED_BUCKET", default="transcoded-videos")
S3_THUMBNAIL_BUCKET = config("S3_THUMBNAIL_BUCKET", default="thumbnails")

S3_MULTIPART_CHUNK_SIZE_MB = config("S3_MULTIPART_CHUNK_SIZE_MB", default=5, cast=int)
# Presigned URL TTL: 12 hours for chunked upload
S3_PRESIGNED_UPLOAD_TTL = config("S3_PRESIGNED_UPLOAD_TTL", default=43200, cast=int)
# Browser-reachable S3 base URL for presigned URLs (differs from AWS_S3_ENDPOINT_URL
# when the service runs in Docker but the browser is on the host, e.g. LocalStack).
# Empty string → use AWS_S3_ENDPOINT_URL unchanged.
S3_PRESIGNED_URL_BASE = config("S3_PRESIGNED_URL_BASE", default="")

# ---------------------------------------------------------------------------
# Kafka
# ---------------------------------------------------------------------------

KAFKA_BOOTSTRAP_SERVERS = config("KAFKA_BOOTSTRAP_SERVERS", default="localhost:9092")
KAFKA_SECURITY_PROTOCOL = config("KAFKA_SECURITY_PROTOCOL", default="PLAINTEXT")

# ---------------------------------------------------------------------------
# Internal API key (used by other services calling /internal/* endpoints)
# ---------------------------------------------------------------------------

INTERNAL_API_KEY = config("INTERNAL_API_KEY", default="dev-internal-key")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "core.logging.StructlogFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": config("LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SERVICE_NAME = "video-service"
