"""Deliverable model (Step 8e, schema.sql "mentor_deliverables").

One table. Mirrors schema.sql with three approved deviations:

1. ``file_id`` is DROPPED. It references ``files(id)``, which is **Step 4**
   (deferred — BUILD_PLAN line 164) and therefore does not exist. A foreign
   key to a missing table cannot be created; 5f made the same call and kept
   evidence as text (5f D6). When Step 4 lands, this column is added with a
   real writer.
2. ``status`` is ``String(24)`` + the named CHECK from schema.sql rather
   than the Postgres ``deliverable_status`` enum, matching every other
   status column in this codebase so both test backends behave identically.
   It is 24 rather than the usual 16 because ``changes_requested`` is 17
   characters — a 16 would pass on SQLite and fail on PostgreSQL.
3. ``reviewed_by`` is ADDED. schema.sql records *when* a deliverable was
   reviewed (``reviewed_at``) but not *who*; without it the startup cannot
   see who accepted their work or asked for changes. It is stamped from
   the token, never accepted from a client (8e plan D-3).

``overdue`` stays in the enum as schema.sql defines it, but nothing writes
it: flipping it needs a scheduler, and a ``due_on < today`` filter gives the
UI the same answer without a cron job (8e plan D-5).

Status flow (``DeliverableStatus``):

::

    not_started --start--> in_progress --submit--> submitted
                             |                        |
                             |                        +--accept----> accepted
                             |                        +--request_changes-->
                             |                             changes_requested
                             |                                   |
                             +<---------- resume ----------------+
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeliverableStatus(enum.StrEnum):
    """schema.sql ``deliverable_status``.

    ``overdue`` is kept for a future worker and is never written by 8e.
    """

    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    changes_requested = "changes_requested"
    accepted = "accepted"
    overdue = "overdue"


# Statuses an assignee may move the row into themselves.
ASSIGNEE_STATUSES: frozenset[DeliverableStatus] = frozenset(
    {DeliverableStatus.in_progress, DeliverableStatus.submitted}
)

# Statuses only the reviewing mentor may set.
REVIEW_STATUSES: frozenset[DeliverableStatus] = frozenset(
    {DeliverableStatus.accepted, DeliverableStatus.changes_requested}
)

_STATUS_SQL = "status IN ('not_started','in_progress','submitted'," "'changes_requested','accepted','overdue')"


class MentorDeliverable(Base):
    """A piece of work a mentor asks a startup to produce."""

    __tablename__ = "mentor_deliverables"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mentorship_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mentorships.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The 5f readiness item this work builds evidence for. Global reference
    # data, so any ACTIVE criterion is a valid target (checked in the service).
    linked_criterion: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("readiness_criteria.id", ondelete="SET NULL"),
        nullable=True,
    )
    # The person doing the work. Must be an active member of the startup
    # (8e plan D-4); nullable because a mentor may create unassigned work.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # String(24), not schema.sql's enum: the longest member is
    # ``changes_requested`` at 17 characters, so the 16 used for the other
    # status columns here would truncate on PostgreSQL (SQLite silently
    # accepts it, which is exactly how this got caught in the PG run).
    status: Mapped[DeliverableStatus] = mapped_column(
        String(24),
        nullable=False,
        default=DeliverableStatus.not_started,
        server_default="not_started",
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Deviation 3: the reviewer, stamped from the token.
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        CheckConstraint(_STATUS_SQL, name="mentor_deliverables_status_valid"),
        CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="mentor_deliverables_title_check",
        ),
        # schema.sql's two partial indexes, kept verbatim.
        Index(
            "mentor_deliverables_mentorship_idx",
            "mentorship_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "mentor_deliverables_due_idx",
            "due_on",
            postgresql_where=text("deleted_at IS NULL AND status <> 'accepted'"),
            sqlite_where=text("deleted_at IS NULL AND status <> 'accepted'"),
        ),
        # \"work assigned to me\" needs the reverse lookup.
        Index("mentor_deliverables_owner_idx", "owner_id"),
    )


__all__ = [
    "ASSIGNEE_STATUSES",
    "REVIEW_STATUSES",
    "DeliverableStatus",
    "MentorDeliverable",
]
