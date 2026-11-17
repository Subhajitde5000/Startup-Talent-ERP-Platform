"""User and role models (schema.sql section 2, Step 2 subset).

Deviations from schema.sql (documented, for portability):
- citext -> String (case-insensitive uniqueness enforced in service layer
  by normalising to lowercase; production hardening can migrate to citext).
- inet -> String (IP stored as text; validated as IP in service layer).
- Native ENUM -> VARCHAR + CHECK via Enum(native_enum=False) so the same
  models run on PostgreSQL (prod) and SQLite (tests). Values match schema.sql.
- Partial unique indexes (WHERE deleted_at IS NULL): real partial indexes on
  both dialects (Step 3a). Earlier Steps 1-2 used plain unique constraints;
  0003_foundation migrates them.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(enum.StrEnum):
    startup = "startup"
    mentor = "mentor"
    investor = "investor"
    jobseeker = "jobseeker"
    employer = "employer"
    admin = "admin"


class AccountStatus(enum.StrEnum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"
    deleted = "deleted"


class ReviewState(enum.StrEnum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"
    expired = "expired"


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    primary_email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    handle: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_initials: Mapped[str | None] = mapped_column(String(3), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    locale: Mapped[str] = mapped_column(String(16), nullable=False, default="en-IN")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    status: Mapped[AccountStatus] = mapped_column(
        SAEnum(AccountStatus, name="account_status", native_enum=False),
        nullable=False,
        default=AccountStatus.pending,
    )
    verification: Mapped[ReviewState] = mapped_column(
        SAEnum(ReviewState, name="review_state", native_enum=False),
        nullable=False,
        default=ReviewState.unverified,
    )
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    onboarding_step: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Frontend gap approved in the Step 3 plan (profile edit page writes these).
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    twitter_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    website_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Frontend gap approved for the founder profile edit page (Step 3 pass 1):
    # headline/bio/education/prior_role/din_number are user-level profile text;
    # company is derived from the user's organization (3b), not stored here.
    headline: Mapped[str | None] = mapped_column(String(160), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    education: Mapped[str | None] = mapped_column(Text, nullable=True)
    prior_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    founder_vision: Mapped[str | None] = mapped_column(Text, nullable=True)
    din_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Privacy toggles approved for this pass (talent-owned toggles land in 3c).
    profile_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    allow_outreach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("users_status_idx", "status"),
        Index("users_last_active_idx", "last_active_at"),
        Index(
            "users_primary_email_key",
            "primary_email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "users_handle_key",
            "handle",
            unique=True,
            postgresql_where=text("handle IS NOT NULL AND deleted_at IS NULL"),
            sqlite_where=text("handle IS NOT NULL AND deleted_at IS NULL"),
        ),
        CheckConstraint(
            "primary_email = lower(primary_email)",
            name="users_primary_email_lower_check",
        ),
    )


class UserRoleRow(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", native_enum=False),
        primary_key=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "role", name="user_roles_pkey"),
        Index("user_roles_role_idx", "role"),
    )
