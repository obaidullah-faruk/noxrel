from .settings import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Disable caching in tests
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Silence Kafka — tests mock it
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"

# Use gateway-header auth in tests so we don't need to mint real JWTs
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]  # noqa: F405
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.GatewayHeaderAuthentication",
    ],
}
