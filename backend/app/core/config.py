from functools import lru_cache

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database & Redis
    DATABASE_URL: str = "postgresql+asyncpg://forma:formadev@localhost:5434/startup_database"
    REDIS_URL: str = "redis://localhost:6380/0"

    # JWT Authentication
    JWT_SECRET: str = "super-secret-development-key-that-is-guaranteed-to-be-over-64-characters-long-for-forma-backend"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Email
    EMAIL_PROVIDER: str = "smtp"  # "smtp" or "resend"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@forma.local"
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = "noreply@forma.dev"

    # CORS & Web
    CORS_ORIGINS: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    # Security & Rate Limiting
    LOGIN_MAX_ATTEMPTS_PER_IP: int = 10
    LOGIN_MAX_ATTEMPTS_PER_EMAIL: int = 5
    LOGIN_LOCKOUT_WINDOW_SECONDS: int = 900
    RESEND_VERIFICATION_COOLDOWN_SECONDS: int = 60

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
