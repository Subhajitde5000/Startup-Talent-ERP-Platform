"""Investor engagement models (Step 9f: requests, introductions, meetings).

``schema.sql`` has NO tables for this step (GAP) — the shapes come from
the frontend pages they serve (``/investor/requests``,
``/investor/meetings``, ``/startup/meetings``) and were proposed in the
approved 9f plan:

- ``investor_engagement_requests``: the ask/answer flow — intro
  requests, meeting proposals and information requests between an
  investor firm and a startup. ``decline_reason`` is investor-private
  (never shown on the startup side).
- ``investor_meetings``: the scheduled event. A meeting may be linked
  to a request and/or a 9e deal. ``organizer_org_id`` records who
  proposed it.

Portable-types policy (same as the rest of the project): the fixed
vocabularies (``kind``, ``status``, ``meeting_type``) are VARCHAR +
named CHECKs, never native PG enums. ``expires_on`` is server-computed
from the client's ``expires_in_days``.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

_LIVE = text("deleted_at IS NULL")


class RequestKind(enum.StrEnum):
    """What kind of engagement the request is."""

    intro = "intro"
    meeting = "meeting"
    information = "information"


class RequestStatus(enum.StrEnum):
    """Lifecycle of an engagement request."""

    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    withdrawn = "withdrawn"
    expired = "expired"


class MeetingType(enum.StrEnum):
    """The meeting categories the pages use."""

    intro_call = "intro_call"
    pitch = "pitch"
    diligence = "diligence"
    follow_up = "follow_up"
    other = "other"


class MeetingStatus(enum.StrEnum):
    """Lifecycle of a meeting."""

    proposed = "proposed"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


_KIND_SQL = "kind IN ('intro','meeting','information')"
_REQUEST_STATUS_SQL = (
    "status IN ('pending','accepted','declined','withdrawn','expired')"
)
_MEETING_TYPE_SQL = (
    "meeting_type IN ('intro_call','pitch','diligence','follow_up','other')"
)
_MEETING_STATUS_SQL = (
    "status IN ('proposed','confirmed','cancelled','completed')"
)


class InvestorEngagementRequest(Base):
    """One ask from an investor firm to a startup (9f)."""

    __tablename__ = "investor_engagement_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    startup_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_deals.id", ondelete="SET NULL"),
        nullable=True,
    )
    kind: Mapped[RequestKind] = mapped_column(
        SAEnum(RequestKind, name="engagement_request_kind", native_enum=False, length=16),
        nullable=False,
    )
    ask: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        SAEnum(
            RequestStatus,
            name="engagement_request_status",
            native_enum=False,
            length=16,
        ),
        nullable=False,
        default=RequestStatus.pending,
        server_default="pending",
    )
    response_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Investor-private: the startup's decline reason is never shown to
    # the investor through the startup-side view.
    decline_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(_KIND_SQL, name="engagement_request_kind_valid"),
        CheckConstraint(_REQUEST_STATUS_SQL, name="engagement_request_status_valid"),
        CheckConstraint(
            "length(trim(ask)) BETWEEN 1 AND 200",
            name="engagement_request_ask_check",
        ),
        # At most one open request per (investor, startup, kind). The
        # predicate only covers non-terminal statuses so withdrawn /
        # declined / expired requests free the slot for a new one.
        Index(
            "investor_engagement_requests_unique",
            "investor_org_id",
            "startup_org_id",
            "kind",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND status IN ('pending','accepted')"
            ),
            sqlite_where=text(
                "deleted_at IS NULL AND status IN ('pending','accepted')"
            ),
        ),
        Index(
            "investor_engagement_requests_investor_idx",
            "investor_org_id",
            "status",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_engagement_requests_startup_idx",
            "startup_org_id",
            "status",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
    )


class InvestorMeeting(Base):
    """A meeting scheduled between an investor firm and a startup (9f)."""

    __tablename__ = "investor_meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    startup_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_engagement_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_deals.id", ondelete="SET NULL"),
        nullable=True,
    )
    meeting_type: Mapped[MeetingType] = mapped_column(
        SAEnum(MeetingType, name="meeting_type", native_enum=False, length=16),
        nullable=False,
        default=MeetingType.intro_call,
        server_default="intro_call",
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=30, server_default="30"
    )
    agenda: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[MeetingStatus] = mapped_column(
        SAEnum(
            MeetingStatus, name="meeting_status", native_enum=False, length=16
        ),
        nullable=False,
        default=MeetingStatus.proposed,
        server_default="proposed",
    )
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    organizer_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(_MEETING_TYPE_SQL, name="meeting_type_valid"),
        CheckConstraint(_MEETING_STATUS_SQL, name="meeting_status_valid"),
        CheckConstraint(
            "duration_minutes >= 15 AND duration_minutes <= 480",
            name="meeting_duration_check",
        ),
        CheckConstraint(
            "organizer_org_id IN (investor_org_id, startup_org_id)",
            name="meeting_organizer_valid",
        ),
        Index(
            "investor_meetings_investor_idx",
            "investor_org_id",
            "status",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_meetings_startup_idx",
            "startup_org_id",
            "status",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index("investor_meetings_scheduled_idx", "scheduled_at"),
    )


__all__ = [
    "InvestorEngagementRequest",
    "InvestorMeeting",
    "MeetingStatus",
    "MeetingType",
    "RequestKind",
    "RequestStatus",
]
