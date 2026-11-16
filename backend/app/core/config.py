"""Application configuration via pydantic-settings.

All secrets come from environment variables. Never hard-code secrets.
See backend/.env.example for the full list.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Forma API"
    ENVIRONMENT: Literal["dev", "test", "prod"] = "dev"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database: production uses PostgreSQL (asyncpg). Tests override with SQLite.
    # Default is a local SQLite file so the app starts without Postgres in dev/sandbox.
    DATABASE_URL: str = "sqlite+aiosqlite:///./forma.db"

    # JWT
    JWT_SECRET: str = Field(
        default="dev-only-insecure-secret-change-in-prod-32chars",
        min_length=32,
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Token lifetimes (minutes)
    VERIFICATION_CODE_EXPIRE_MINUTES: int = 10
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    RESEND_COOLDOWN_SECONDS: int = 60

    # Frontend origin, used to build absolute links in emails (password reset).
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Email
    EMAIL_PROVIDER: Literal["smtp", "resend", "console", "memory"] = "console"
    EMAIL_FROM: str = "Forma <no-reply@forma.example>"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = False
    RESEND_API_KEY: str = ""

    # Redis (empty = in-memory fallback for dev/test without Redis)
    REDIS_URL: str = ""

    # Rate limits
    LOGIN_IP_LIMIT: int = 20
    LOGIN_IP_WINDOW_SECONDS: int = 300
    LOGIN_ACCOUNT_LIMIT: int = 10
    LOGIN_ACCOUNT_WINDOW_SECONDS: int = 300
    REGISTER_IP_LIMIT: int = 10
    REGISTER_IP_WINDOW_SECONDS: int = 3600
    FORGOT_IP_LIMIT: int = 5
    FORGOT_IP_WINDOW_SECONDS: int = 3600
    VERIFY_IP_LIMIT: int = 20
    VERIFY_IP_WINDOW_SECONDS: int = 300
    VERIFY_ACCOUNT_LIMIT: int = 10
    VERIFY_ACCOUNT_WINDOW_SECONDS: int = 300

    # CORS: explicit allow-list only, never "*" with credentials.
    CORS_ORIGINS: list[str] = Field(default=["http://localhost:3000", "http://127.0.0.1:3000"])

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value: object) -> object:
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    @property
    def is_prod(self) -> bool:
        return self.ENVIRONMENT == "prod"

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT == "test"


@lru_cache
def get_settings() -> Settings:
    return Settings()
