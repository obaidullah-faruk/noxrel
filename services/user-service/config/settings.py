from datetime import timedelta
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
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "drf_spectacular",
]

LOCAL_APPS = [
    "accounts",
    "auth_api",
    "roles",
    "subscriptions",
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
    "allauth.account.middleware.AccountMiddleware",
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
        "NAME": config("DB_NAME", default="user_service"),
        "USER": config("DB_USER", default="postgres"),
        "PASSWORD": config("DB_PASSWORD", default="postgres"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"connect_timeout": 10},
    }
}

# ---------------------------------------------------------------------------
# Cache (Redis)
# ---------------------------------------------------------------------------

REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 5,
            "SOCKET_TIMEOUT": 5,
        },
        "KEY_PREFIX": "user_svc",
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# ---------------------------------------------------------------------------
# Custom User
# ---------------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# JWT (RS256) — keys as env vars, no file indirection
# ---------------------------------------------------------------------------

# Dev default: a self-signed RSA key pair generated once for local use.
# In production inject JWT_PRIVATE_KEY and JWT_PUBLIC_KEY via secrets manager.
_DEFAULT_PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCRz9B/1kzRVzp8
J+rFBKKsB9dF+5FsfBZ+Wadk8cRz0sAt+1ncb7U1+cW1mCQisdtzls/OvIQmAusM
77uFsXfq1+IXVpoJzrYc2DAXHR0k3zM20jHp51lzmlD2Fw7rw1m/M398jc8l5dqH
0kdn54hINzj/klRkZfLS63H0h31ERJlvfrR8sEwbU6Z09lD3H8CVvt+QuwolFZ9J
RbQRYE7/AfmwGaLfXPHxGARtRc0sAbTsdvGu1PiO3LZV/2njc1KqMY1QjFhVRWrs
E3BAw9BzEUFPGFIu946PVO81crV3Cjc8J5A24roip6kMbWPrGpZ8Y8YWZkv0/TXe
q63WpeuxAgMBAAECggEAAe7cMphVNrXuKmTfFGiTfYNcbmrqNSLPVjJ7E81ZZOMH
it8uWaFI046G+U7V383gJ7/5QPeNKvHWoDpyD9DX/aQ0tPQqy57SxD7LeGr5jsUU
vpElJJbdao5tAgOGk5094dkyw08f+WklhK/GzuZUugcIDun84MMx58DuUacVg+Oo
dwblJuzqtF+TbrLBIlIdpklbmL5zawf8IWAXuj1bBP6DiobfIst+FaS8hV49Ohgu
a+OszFqDuGPM0rZ7vL5LCFd+QVJOe/FOMjAA7GH8qFrEC1Dy1b8TbjPwoqXh12aC
0y3VwVyo7Tx5fGYuGqnZmp5HEVlAJS5IrBr+ByX2rwKBgQDMFISgoFzFjH0dw3Fq
RARhY8M91qiXnBGaInVigXk8IiVErXn1szxndIlmcfkrglKFK3KgCo3uINQpSGiY
KL3kjbXWOYKbQtJw/8CQxElswJD6oKpI3V4HdDzYi7lBEDcHVfss7uLm/p2KsxoF
NbPecmC0HyfXUdsoYzaY7s8BJwKBgQC26FnVpQKn0RmsN0iMOHWwsbXuy+JfPbZu
VUDYBSXnmAC975h1b1FwXsCPg1md+snlh+zKPhb9ycLaZPXPD1AWj6JJF/PxWQe7
jtyKBc97UNkLSR9FkOCI8Fv0T4IDz9yAFeiKNwhujJIIe+Xbr3kBqU3bH8MyQ3FC
D3gvbn8DZwKBgQCQ2jttG4XdviMMXi4BJDgLvFjXaqaNvfwMcErrWUTo9r+HKK65
Q7grIl9oNJuMU1spJLaee/9Ttz9/8eIzpi9qq18WqAlZFKv0AsP2vSv0ohYFnsZf
I6jbF5kchsg+Mzkr3s6CjSjGlpDR4uAkNILv8DVNhBOuVG5/EzSshkyt3wKBgAeE
yZyUqeVIHSwNIbhR4dSfmYD1dJrBqKwkaQP4QjSg9PbZ0ISTTN+3pWbA2YA6/O2o
hr1RjBRmpNHhcJFQadRjlyI2D9sN89lr5/jsgDjre+CQ4u4zJGe8qasDUa7ibof9
Xo+/72LL+HzMywga0HiXAxJM3fNE/nTeuewJOMNlAoGAclL8OrIZfP3Bki5hstV5
zY6xq/c1VJugLw4h4hZZqjtA2jpWpaxA8vAcuR3t8hI6wEVRwj6PZz1liyOJsmME
PyNNWvs4QesqHYe66AzUxn1qBpPT/RmRu0N+Z5d4PwKfpnthBDXs9KRl9CJdKOwU
1Gty9eaGck8TrLKR4mFacDU=
-----END PRIVATE KEY-----"""

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
    """Read a PEM key from env var. Handles escaped newlines from docker env files."""
    value = config(env_var, default="").strip()
    if value:
        return value.replace("\\n", "\n")
    return default


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "RS256",
    "SIGNING_KEY": _get_jwt_key("JWT_PRIVATE_KEY", _DEFAULT_PRIVATE_KEY),
    "VERIFYING_KEY": _get_jwt_key("JWT_PUBLIC_KEY", _DEFAULT_PUBLIC_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
    "TOKEN_OBTAIN_SERIALIZER": "auth_api.serializers.CustomTokenObtainPairSerializer",
}

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/day",
        "user": "1000/day",
        "auth": "10/minute",
    },
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
}

# ---------------------------------------------------------------------------
# drf-spectacular (Swagger/OpenAPI)
# ---------------------------------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "User Service API",
    "DESCRIPTION": "Authentication, user management, RBAC, and subscription endpoints.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
}

# ---------------------------------------------------------------------------
# django-allauth (Google OAuth2)
# ---------------------------------------------------------------------------

SITE_ID = 1

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": config("GOOGLE_CLIENT_ID", default=""),
            "secret": config("GOOGLE_CLIENT_SECRET", default=""),
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    }
}

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "optional"

# ---------------------------------------------------------------------------
# Kafka
# ---------------------------------------------------------------------------

KAFKA_BOOTSTRAP_SERVERS = config("KAFKA_BOOTSTRAP_SERVERS", default="localhost:9092")
KAFKA_SECURITY_PROTOCOL = config("KAFKA_SECURITY_PROTOCOL", default="PLAINTEXT")

# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

RBAC_CACHE_TTL = 60  # seconds

# ---------------------------------------------------------------------------
# Logging (structured JSON via structlog)
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
# Dev admin credentials (used by create_dev_admin management command)
# ---------------------------------------------------------------------------

DEV_ADMIN_EMAIL = config("DEV_ADMIN_EMAIL", default="admin@admin.com")
DEV_ADMIN_USERNAME = config("DEV_ADMIN_USERNAME", default="admin")
DEV_ADMIN_PASSWORD = config("DEV_ADMIN_PASSWORD", default="admin1234")

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
SERVICE_NAME = "user-service"
