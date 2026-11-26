"""Application configuration via pydantic-settings.

All secrets come from environment variables. Never hard-code secrets.
See backend/.env.example for the full list.
"""

from decimal import Decimal
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Forma API"
    ENVIRONMENT: Literal["dev", "development", "test", "prod"] = "dev"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database: production uses PostgreSQL (asyncpg). Tests override with SQLite.
    # Default is a local SQLite file so the app starts without Postgres in dev/sandbox.
    DATABASE_URL: str = "sqlite+aiosqlite:///./forma.db"

    # Step 4: private Cloudflare R2, accessed only by the server.
    R2_ACCOUNT_ID: str = Field(default="", pattern=r"^([a-f0-9]{32})?$")
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = ""
    FILE_SCANNER: Literal["unconfigured", "dev_clean"] = "unconfigured"
    FILE_UPLOAD_TTL_SECONDS: int = Field(default=300, ge=30, le=900)
    FILE_DOWNLOAD_TTL_SECONDS: int = Field(default=60, ge=10, le=300)
    FILE_UPLOAD_USER_LIMIT: int = Field(default=20, ge=1)
    FILE_UPLOAD_ORG_LIMIT: int = Field(default=100, ge=1)
    FILE_ACTION_LIMIT: int = Field(default=60, ge=1)
    FILE_DOWNLOAD_LIMIT: int = Field(default=120, ge=1)
    FILE_PENDING_LIMIT: int = Field(default=10, ge=1)
    FILE_RETENTION_HOURS: int = Field(default=24, ge=1)

    @model_validator(mode="after")
    def _safe_file_scanner(self) -> "Settings":
        if self.ENVIRONMENT == "prod" and self.FILE_SCANNER == "dev_clean":
            raise ValueError("dev_clean file scanner is forbidden in production")
        return self

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

    # DPDP data requests: due_at = received_at + this many days (Step 3a).
    DATA_REQUEST_DUE_DAYS: int = 30

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

    JOB_DISCOVERY_LIMIT: int = 60
    APPLICATION_SUBMIT_LIMIT: int = 20
    APPLICATION_WITHDRAW_LIMIT: int = 30

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
    # Step 5f: readiness state transitions, per actor.
    READINESS_ACTION_LIMIT: int = 30
    READINESS_ACTION_WINDOW_SECONDS: int = 300
    # Step 5i/5j: stage changes and stage-tool writes, per actor.
    STAGE_WRITE_LIMIT: int = 30
    STAGE_WRITE_WINDOW_SECONDS: int = 300
    # Step 5e: metric upsert/delete, per actor. A founder entering the
    # eight keys for six months is 48 writes, so the window is comfortable.
    METRICS_WRITE_LIMIT: int = 60
    METRICS_WRITE_WINDOW_SECONDS: int = 300
    # Step 5l: market-size and competitor writes, per actor. A team filling
    # in TAM/SAM/SOM across three scenarios plus a dozen competitors is
    # comfortably under this; a scripted loop is cut off.
    ANALYTICS_WRITE_LIMIT: int = 60
    ANALYTICS_WRITE_WINDOW_SECONDS: int = 300
    # Step 3d: invite resend, per invite and per organization. A resend
    # mails a third party, so the per-invite cap is deliberately small.
    INVITE_RESEND_LIMIT: int = 3
    INVITE_RESEND_WINDOW_SECONDS: int = 3600
    INVITE_RESEND_ORG_LIMIT: int = 20
    INVITE_RESEND_ORG_WINDOW_SECONDS: int = 3600
    # Step 3d: last_active_at is written at most this often per member, so
    # reading the team page does not mean one UPDATE per member per request.
    LAST_ACTIVE_THROTTLE_SECONDS: int = 300
    # Step 5d: comment writes, per actor. A team discussing a task is
    # comfortably under this; a scripted loop is cut off (BUILD_PLAN 5d:
    # "Rate-limit comments").
    TASK_COMMENT_LIMIT: int = 30
    TASK_COMMENT_WINDOW_SECONDS: int = 300
    # Step 8a: mentor directory searches, per user. Browsing a directory is
    # a handful of requests per session; a scraper is cut off well before
    # it can walk the whole mentor table.
    MENTOR_SEARCH_LIMIT: int = 60
    MENTOR_SEARCH_WINDOW_SECONDS: int = 300
    # Step 8b: asking a mentor to work with you. Low on purpose — a startup
    # sends a handful of requests, a spammer would send hundreds.
    MENTORSHIP_REQUEST_LIMIT: int = 10
    MENTORSHIP_REQUEST_WINDOW_SECONDS: int = 300
    # Step 8b: state transitions (accept/decline/cancel/end/pause/resume).
    # Higher than requests: these are normal back-and-forth.
    SESSION_REVIEW_WRITE_LIMIT: int = 30
    SESSION_REVIEW_WRITE_WINDOW_SECONDS: int = 300

    MENTORSHIP_ACTION_LIMIT: int = 60
    MENTORSHIP_ACTION_WINDOW_SECONDS: int = 300
    # Step 8c: the mentor's own availability grid is rewritten whole.
    AVAILABILITY_WRITE_LIMIT: int = 30
    AVAILABILITY_WRITE_WINDOW_SECONDS: int = 300
    # Step 8d: sessions are scheduled far less often than requests.
    SESSION_WRITE_LIMIT: int = 30
    SESSION_WRITE_WINDOW_SECONDS: int = 300
    # Step 8d: how far ahead a session may be booked.
    SESSION_MAX_DAYS_AHEAD: int = 180
    # Step 8e: deliverables are edited in bursts while a startup works on
    # one, so the cap is higher than a request or a slot write.
    DELIVERABLE_WRITE_LIMIT: int = 60
    DELIVERABLE_WRITE_WINDOW_SECONDS: int = 300
    # Step 8h: the mentor reading their own earnings.
    EARNING_READ_LIMIT: int = 120
    EARNING_READ_WINDOW_SECONDS: int = 60
    # Step 9a: rounds are edited in bursts while a startup plans a raise,
    # so the cap matches the metrics/deliverable write limits.
    FUNDING_ROUND_WRITE_LIMIT: int = 60
    FUNDING_ROUND_WRITE_WINDOW_SECONDS: int = 300
    # Step 9b/9c: investor directory and startup discovery searches are
    # read-heavy list endpoints (the mentor-search precedent: a search
    # box is not a batch API).
    INVESTOR_DIRECTORY_SEARCH_LIMIT: int = 60
    INVESTOR_DIRECTORY_SEARCH_WINDOW_SECONDS: int = 300
    INVESTOR_DISCOVERY_SEARCH_LIMIT: int = 60
    INVESTOR_DISCOVERY_SEARCH_WINDOW_SECONDS: int = 300
    # Step 9d: preferences, saved searches and shortlist edits.
    INVESTOR_SEARCH_WRITE_LIMIT: int = 30
    INVESTOR_SEARCH_WRITE_WINDOW_SECONDS: int = 300
    # Step 9e: the deal board is edited while an investor works a
    # pipeline, so the cap matches the round/metrics write limits.
    INVESTOR_DEAL_WRITE_LIMIT: int = 60
    INVESTOR_DEAL_WRITE_WINDOW_SECONDS: int = 300
    # Step 9i: offers are financial documents edited in bursts while an
    # investor negotiates terms, so the cap matches the deal write limit.
    OFFER_WRITE_LIMIT: int = 60
    OFFER_WRITE_WINDOW_SECONDS: int = 300
    # Step 9f: intro/meeting/information requests are the lightest
    # investor action but still rate-limited; the demo page caps intro
    # requests at 5 per day.
    INVESTOR_REQUEST_DAILY_LIMIT: int = 5
    INVESTOR_REQUEST_DAILY_WINDOW_SECONDS: int = 86400
    ENGAGEMENT_WRITE_LIMIT: int = 60
    ENGAGEMENT_WRITE_WINDOW_SECONDS: int = 300
    # Step 9j: commitments and holdings are edited while a round closes.
    COMMITMENT_WRITE_LIMIT: int = 60
    COMMITMENT_WRITE_WINDOW_SECONDS: int = 300
    PORTFOLIO_WRITE_LIMIT: int = 60
    PORTFOLIO_WRITE_WINDOW_SECONDS: int = 300
    # Step 9k: diligence checklists are edited in bursts while a deal
    # advances through diligence.
    DILIGENCE_WRITE_LIMIT: int = 60
    DILIGENCE_WRITE_WINDOW_SECONDS: int = 300
    # Step 8h: commission and TDS withheld from a mentor's fee.
    #
    # BOTH DEFAULT TO 0 ON PURPOSE. BUILD_PLAN.md, schema.sql and this
    # codebase define no rate anywhere, and inventing a percentage would
    # put a wrong number into money that 14f eventually pays out. At 0 the
    # columns and the arithmetic are correct and honest (net == gross);
    # finance/legal supply the real rates before 14f releases a payout.
    MENTOR_COMMISSION_PCT: Decimal = Decimal("0")
    MENTOR_TDS_PCT: Decimal = Decimal("0")

    # Step 9g/9h: reuse the shared limiter, independently bounded policies.
    DATA_ROOM_WRITE_LIMIT: int = Field(default=60, ge=1)
    DATA_ROOM_ORG_WRITE_LIMIT: int = Field(default=300, ge=1)
    DATA_ROOM_REQUEST_LIMIT: int = Field(default=10, ge=1)
    DATA_ROOM_NDA_LIMIT: int = Field(default=10, ge=1)
    DATA_ROOM_CONTENT_LIMIT: int = Field(default=120, ge=1)

    # Step 7a: all job mutations share one per-user limit.
    JOB_WRITE_LIMIT: int = Field(default=60, ge=1)
    JOB_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7d: shared limiter, per authenticated actor per minute.
    APPLICANT_READ_LIMIT: int = Field(default=120, ge=1)
    APPLICANT_WRITE_LIMIT: int = Field(default=60, ge=1)

    # Step 7e: scorecard template CRUD has its own keys; application score
    # reads/writes reuse the 7d applicant budget through the shared scope.
    SCORECARD_READ_LIMIT: int = Field(default=120, ge=1)
    SCORECARD_WRITE_LIMIT: int = Field(default=60, ge=1)

    # Step 7f: interviews are read far more often than they are changed.
    INTERVIEW_READ_LIMIT: int = Field(default=120, ge=1)
    INTERVIEW_WRITE_LIMIT: int = Field(default=30, ge=1)
    INTERVIEW_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7g: job offers are read often (lists, candidate views) and edited
    # in bursts while an employer negotiates terms. Reuse the shared limiter.
    # Named JOB_OFFER_* because Step 9i already owns OFFER_WRITE_* for
    # investor offers — two features, two budgets, one limiter.
    JOB_OFFER_READ_LIMIT: int = Field(default=120, ge=1)
    JOB_OFFER_WRITE_LIMIT: int = Field(default=30, ge=1)
    JOB_OFFER_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7h: hires, onboarding and hire documents. The same read/write
    # split as the rest of the pipeline.
    HIRE_READ_LIMIT: int = Field(default=120, ge=1)
    HIRE_WRITE_LIMIT: int = Field(default=30, ge=1)
    HIRE_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7i: hiring requests. Read-heavy list plus calm submit/approve/
    # convert writes; the window matches the pipeline's 60s.
    HIRING_REQUEST_READ_LIMIT: int = Field(default=120, ge=1)
    HIRING_REQUEST_WRITE_LIMIT: int = Field(default=30, ge=1)
    HIRING_REQUEST_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7j: talent search, shortlist writes, and outreach sends.
    # Outreach is a per-user per-UTC-day budget (86400s), not a minute.
    TALENT_SEARCH_LIMIT: int = Field(default=60, ge=1)
    TALENT_SHORTLIST_WRITE_LIMIT: int = Field(default=60, ge=1)
    TALENT_OUTREACH_DAILY_LIMIT: int = Field(default=50, ge=1)
    TALENT_OUTREACH_DAILY_WINDOW_SECONDS: int = Field(default=86400, ge=1)

    # Step 7l: employer hiring dashboard / analytics / activity reads are
    # shared by all active org members, but still budgeted per actor.
    EMPLOYER_ANALYTICS_READ_LIMIT: int = Field(default=120, ge=1)
    EMPLOYER_ANALYTICS_READ_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7m: job-seeker saved jobs and alerts. Writes are calm (bookmarks
    # and alert edits); reads share the same per-actor per-minute budget.
    SAVED_JOBS_WRITE_LIMIT: int = Field(default=60, ge=1)
    SAVED_JOBS_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)
    SAVED_JOBS_READ_LIMIT: int = Field(default=120, ge=1)
    SAVED_JOBS_READ_WINDOW_SECONDS: int = Field(default=60, ge=1)
    JOB_ALERTS_WRITE_LIMIT: int = Field(default=60, ge=1)
    JOB_ALERTS_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)
    JOB_ALERTS_READ_LIMIT: int = Field(default=120, ge=1)
    JOB_ALERTS_READ_WINDOW_SECONDS: int = Field(default=60, ge=1)

    # Step 7n/7o: resume builder, rule-based ATS check, and AI tailoring (Groq).
    RESUME_READ_LIMIT: int = Field(default=120, ge=1)
    RESUME_READ_WINDOW_SECONDS: int = Field(default=60, ge=1)
    RESUME_WRITE_LIMIT: int = Field(default=60, ge=1)
    RESUME_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)
    RESUME_ATS_WRITE_LIMIT: int = Field(default=30, ge=1)
    RESUME_ATS_WRITE_WINDOW_SECONDS: int = Field(default=60, ge=1)
    AI_TAILOR_LIMIT: int = Field(default=10, ge=1)
    AI_TAILOR_WINDOW_SECONDS: int = Field(default=3600, ge=1)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

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

    @property
    def is_r2_configured(self) -> bool:
        """True when all R2 credentials are present (R2 storage is usable)."""
        return bool(
            self.R2_ACCOUNT_ID
            and self.R2_ACCESS_KEY_ID
            and self.R2_SECRET_ACCESS_KEY
            and self.R2_BUCKET
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
