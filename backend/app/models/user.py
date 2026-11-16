import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SQLEnum

from app.db.base import Base, TimestampedBase


class UserRoleEnum(str, enum.Enum):
    startup = "startup"
    mentor = "mentor"
    investor = "investor"
    jobseeker = "jobseeker"
    employer = "employer"
    admin = "admin"


class AccountStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"
    deleted = "deleted"


class ReviewState(str, enum.Enum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"
    expired = "expired"


class User(TimestampedBase):
    __tablename__ = "users"

    primary_email: Mapped[str] = mapped_column(Text, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    handle: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_initials: Mapped[str | None] = mapped_column(String(3), nullable=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    locale: Mapped[str] = mapped_column(Text, nullable=False, default="en-IN", server_default="en-IN")
    timezone: Mapped[str] = mapped_column(Text, nullable=False, default="Asia/Kolkata", server_default="Asia/Kolkata")
    status: Mapped[AccountStatus] = mapped_column(
        SQLEnum(AccountStatus, name="account_status", native_enum=True),
        nullable=False,
        default=AccountStatus.pending,
        server_default="pending",
    )
    verification: Mapped[ReviewState] = mapped_column(
        SQLEnum(ReviewState, name="review_state", native_enum=True),
        nullable=False,
        default=ReviewState.unverified,
        server_default="unverified",
    )
    region: Mapped[str | None] = mapped_column(Text, nullable=True)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    onboarding_step: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[list["AuthSession"]] = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
    verification_tokens: Mapped[list["EmailVerificationToken"]] = relationship(
        "EmailVerificationToken", back_populates="user", cascade="all, delete-orphan"
    )
    reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        "PasswordResetToken", back_populates="user", cascade="all, delete-orphan"
    )
    login_attempts: Mapped[list["LoginAttempt"]] = relationship("LoginAttempt", back_populates="user")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[UserRoleEnum] = mapped_column(
        SQLEnum(UserRoleEnum, name="user_role", native_enum=True),
        primary_key=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="roles")


class AuthSession(TimestampedBase):
    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    refresh_token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    region: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    replaced_by_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="verification_tokens")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requested_ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="reset_tokens")


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )
    email: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    ip: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped["User | None"] = relationship("User", back_populates="login_attempts")
