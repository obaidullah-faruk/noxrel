from pydantic_settings import BaseSettings, SettingsConfigDict

# Dev RS256 public key — must match user-service's private key and the other
# verify-only services (video-service settings._DEFAULT_PUBLIC_KEY). Used only
# when JWT_PUBLIC_KEY is unset, exactly like the other services' dev fallback.
_DEFAULT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkc/Qf9ZM0Vc6fCfqxQSi
rAfXRfuRbHwWflmnZPHEc9LALftZ3G+1NfnFtZgkIrHbc5bPzryEJgLrDO+7hbF3
6tfiF1aaCc62HNgwFx0dJN8zNtIx6edZc5pQ9hcO68NZvzN/fI3PJeXah9JHZ+eI
SDc4/5JUZGXy0utx9Id9RESZb360fLBMG1OmdPZQ9x/Alb7fkLsKJRWfSUW0EWBO
/wH5sBmi31zx8RgEbUXNLAG07HbxrtT4jty2Vf9p43NSqjGNUIxYVUVq7BNwQMPQ
cxFBTxhSLveOj1TvNXK1dwo3PCeQNuK6IqepDG1j6xqWfGPGFmZL9P013qut1qXr
sQIDAQAB
-----END PUBLIC KEY-----"""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "billing-service"
    debug: bool = False
    secret_key: str = "dev-secret-key-change-in-production"

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "billing_service"
    db_user: str = "noxrel"
    db_password: str = "postgres"

    @property
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def migration_database_url(self) -> str:
        # Alembic runs synchronously — uses the psycopg driver, not asyncpg.
        return f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group: str = "billing-service"

    # Stripe
    stripe_secret_key: str = "sk_test_placeholder"
    stripe_webhook_secret: str = "whsec_placeholder"
    stripe_success_url: str = "http://localhost:3000/billing/success"
    stripe_cancel_url: str = "http://localhost:3000/billing/cancel"

    # Internal gateway shared secret — required when routing via gateway headers
    # instead of a Bearer token. Set GATEWAY_SHARED_SECRET to the same value
    # in the gateway config. Empty string disables the header path entirely.
    gateway_shared_secret: str = ""

    # JWT (RS256 public key — billing-service only verifies, never issues)
    jwt_public_key: str = ""
    jwt_algorithm: str = "RS256"

    @property
    def jwt_verifying_key(self) -> str:
        # An explicit env value wins; otherwise fall back to the dev key.
        # The "\n"-escaped form (env/secret single-line) is normalised to real newlines.
        value = self.jwt_public_key.strip()
        if value:
            return value.replace("\\n", "\n")
        return _DEFAULT_PUBLIC_KEY

    # Observability
    otel_exporter_otlp_endpoint: str = "http://otel-collector:4317"
    log_level: str = "INFO"


settings = Settings()
