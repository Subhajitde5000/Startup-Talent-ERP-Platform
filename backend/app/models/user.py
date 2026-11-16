"""User and role models (schema.sql section 2, Step 2 subset).

Deviations from schema.sql (documented, for portability):
- citext -> String (case-insensitive uniqueness enforced in service layer
  by normalising to lowercase; production hardening can migrate to citext).
- inet -> String (IP stored as text; validated as IP in service layer).
- Native ENUM -> VARCHAR + CHECK via Enum(native_enum=False) so the same
  models run on PostgreSQL (prod) and SQLite (tests). Values match schema.sql.
- Partial unique indexes (WHERE deleted_at IS NULL) -> unique constraints
  for SQLite compatibility; soft-deleted emails are handled in service layer.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
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
    primary_email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    handle: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
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
