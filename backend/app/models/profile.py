"""Profile, skills and data-request models (schema.sql sections 3, 8, 16).

Step 3a subset. Deviations from schema.sql (documented, for portability):
- Native ENUM -> VARCHAR + CHECK via Enum(native_enum=False), same as Step 2.
- score_100 domain -> SmallInteger + CHECK (single named constraint).
- data_requests.assigned_to keeps its column but NOT its FK to admin_members
  (that table arrives in Step 15a; PostgreSQL cannot reference a missing table).
  The FK constraint is added there.
- Every table carries created_at/updated_at per AGENTS.md section 6, including
  skills (schema.sql omits updated_at there; approved in the Step 3 plan).
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
    Integer,
    SmallInteger,
    String,
    Text,
    column,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DataRequestType(enum.StrEnum):
    access = "access"
    erasure = "erasure"
    rectification = "rectification"
    portability = "portability"
    restriction = "restriction"
    objection = "objection"


class DataRequestStatus(enum.StrEnum):
    received = "received"
    verifying = "verifying"
    in_progress = "in_progress"
    fulfilled = "fulfilled"
    rejected = "rejected"
    expired = "expired"


class CasePriority(enum.StrEnum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"
    critical = "critical"


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Skill(Base):
    """Admin/editable lookup of skills (schema.sql section 3)."""

    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # lower(name): citext-style case-insensitive uniqueness (schema.sql).
    __table_args__ = (
        Index("skills_name_key", func.lower(column("name")), unique=True),
    )


class UserReadiness(Base):
    """Per-user readiness scores (schema.sql section 8). All scores 0-100."""

    __tablename__ = "user_readiness"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    profile_complete: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )
    resume_score: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )
    practice_score: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )
    overall_score: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "profile_complete BETWEEN 0 AND 100"
            " AND resume_score BETWEEN 0 AND 100"
            " AND practice_score BETWEEN 0 AND 100"
            " AND overall_score BETWEEN 0 AND 100",
            name="user_readiness_scores_100_check",
        ),
    )


class DataRequest(Base):
    """User data requests, e.g. DPDP erasure (schema.sql section 16).

    Step 3a only RECORDS self-service delete requests; fulfilment and admin
    triage arrive with Step 15.
    """

    __tablename__ = "data_requests"

    id: Mapped[uuid.UUID] = _uuid_pk()
    request_type: Mapped[DataRequestType] = mapped_column(
        SAEnum(DataRequestType, name="data_request_type", native_enum=False),
        nullable=False,
    )
    authority: Mapped[str | None] = mapped_column(String(160), nullable=True)
    data_subject_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    data_subject_label: Mapped[str | None] = mapped_column(String(320), nullable=True)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[DataRequestStatus] = mapped_column(
        SAEnum(DataRequestStatus, name="data_request_status", native_enum=False),
        nullable=False,
        default=DataRequestStatus.received,
        server_default=text("'received'"),
    )
    priority: Mapped[CasePriority] = mapped_column(
        SAEnum(CasePriority, name="case_priority", native_enum=False),
        nullable=False,
        default=CasePriority.normal,
        server_default=text("'normal'"),
    )
    records_identified: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fulfilled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # FK to admin_members (Step 15a) is added in that step; column exists now.
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("data_requests_queue_idx", "status", "due_at"),
        Index("data_requests_subject_idx", "data_subject_id"),
        # Portable substitutes for schema.sql's native enum types.
        CheckConstraint(
            "request_type IN ('access','erasure','rectification',"
            " 'portability','restriction','objection')",
            name="data_requests_request_type_check",
        ),
        CheckConstraint(
            "status IN ('received','verifying','in_progress',"
            " 'fulfilled','rejected','expired')",
            name="data_requests_status_check",
        ),
        CheckConstraint(
            "priority IN ('low','normal','high','urgent','critical')",
            name="data_requests_priority_check",
        ),
    )


class NotificationChannel(enum.StrEnum):
    in_app = "in_app"
    email = "email"
    push = "push"


class NotificationPreference(Base):
    """Per-user notification toggles (schema.sql section 12).

    Step 3 ships the table + read/write stub; the delivery pipeline and the
    full category taxonomy arrive with Step 12 (Notifications).
    """

    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    category: Mapped[str] = mapped_column(String(80), primary_key=True)
    channel: Mapped[NotificationChannel] = mapped_column(
        SAEnum(
            NotificationChannel,
            name="notification_channel",
            native_enum=False,
            length=16,
        ),
        primary_key=True,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
