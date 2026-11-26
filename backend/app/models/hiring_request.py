"""7i: ``hiring_requests`` (schema.sql lines 715-734) plus the
``HiringRequest`` <-> ``Job`` link the schema declares at line 739
(``jobs.request_id``, deferred by 7a's migration 0035 until this step).

The ``Job`` model lives in :mod:`app.models.job` and already carries
``request_id``; importing this module from :mod:`app.models` right after
the job module guarantees the FK target exists for SQLAlchemy.

Deviations from database/schema.sql (portable-types policy):

- ``role_title`` is String(160) (schema.sql ``text``) — the API validates
  1..160; no length CHECK exists in schema.sql either.
- ``department`` is String(16) + a named CHECK over schema.sql's native
  ``department`` enum values (same policy as 7h's ``hires.department``).
- ``urgency``/``status`` are String with the schema.sql CHECKs as model
  CheckConstraints (7h's hires.status precedent).
- ``currency`` is String(3) default "INR" with no value CHECK — exactly
  what schema.sql declares.

GAP columns (migration 0046, phase-B wiring of /employer/requests/new —
the page collects them and schema.sql has no home for them; approved
"fix the API instead of faking it in the frontend"):

- ``employment_type`` / ``work_mode``: String + CHECK over the job enums
  (:class:`app.models.job.EmploymentType` / ``WorkMode``) — carried into
  the draft job on convert.
- ``hiring_manager_id``: owner-type member ref (active, non-viewer) ->
  the converted job's ``owner_id``.
- ``skills``: JSON list of skill names (talent-profile precedent: names,
  resolved case-insensitively against the catalogue on convert).
- ``why_now``: business driver, String + CHECK (growth, replacement,
  new_project, skill_gap). ``justification``: internal free text, never
  copied onto the public job.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HiringRequestStatus(enum.StrEnum):
    """schema.sql ``hiring_request_status_valid``, verbatim."""

    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    fulfilled = "fulfilled"
    cancelled = "cancelled"


class HiringRequestUrgency(enum.StrEnum):
    """schema.sql ``hiring_request_urgency_valid``, verbatim."""

    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class HiringRequestWhyNow(enum.StrEnum):
    """GAP (0046): the business driver behind a request."""

    growth = "growth"
    replacement = "replacement"
    new_project = "new_project"
    skill_gap = "skill_gap"


class HiringRequest(Base):
    """An internal headcount request that can convert into a draft job.

    Content columns are editable while status is draft or pending; the
    status column moves through the lifecycle in :mod:`app.services.
    hiring_request_service` (submit/approve/reject/convert/cancel), never
    from a client write of an arbitrary value.
    """

    __tablename__ = "hiring_requests"
    __table_args__ = (
        CheckConstraint("headcount > 0", name="hiring_request_headcount_check"),
        CheckConstraint(
            "urgency IN ('low', 'normal', 'high', 'urgent')",
            name="hiring_request_urgency_valid",
        ),
        CheckConstraint(
            "status IN ('draft', 'pending', 'approved', 'rejected',"
            " 'fulfilled', 'cancelled')",
            name="hiring_request_status_valid",
        ),
        CheckConstraint(
            "department IS NULL OR department IN ('engineering', 'product',"
            " 'design', 'sales', 'marketing', 'operations', 'finance',"
            " 'people', 'legal', 'support', 'other')",
            name="hiring_requests_department_check",
        ),
        CheckConstraint(
            "employment_type IN ('full_time', 'part_time', 'contract',"
            " 'internship', 'temporary')",
            name="hiring_requests_employment_type_check",
        ),
        CheckConstraint(
            "work_mode IN ('onsite', 'hybrid', 'remote')",
            name="hiring_requests_work_mode_check",
        ),
        CheckConstraint(
            "why_now IS NULL OR why_now IN ('growth', 'replacement',"
            " 'new_project', 'skill_gap')",
            name="hiring_requests_why_now_check",
        ),
        Index("hiring_requests_org_idx", "org_id", "status"),
        Index("hiring_requests_hiring_manager_idx", "hiring_manager_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    role_title: Mapped[str] = mapped_column(String(160))
    department: Mapped[str | None] = mapped_column(String(16), default=None)
    headcount: Mapped[int] = mapped_column(SmallInteger, default=1)
    urgency: Mapped[str] = mapped_column(
        String(8), default=HiringRequestUrgency.normal.value
    )
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    target_start: Mapped[date | None] = mapped_column(Date, default=None)
    budget_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), default=None
    )
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    # GAP columns (0046) — see module docstring.
    employment_type: Mapped[str] = mapped_column(String(12), default="full_time")
    work_mode: Mapped[str] = mapped_column(String(8), default="onsite")
    hiring_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    why_now: Mapped[str | None] = mapped_column(String(12), default=None)
    justification: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[str] = mapped_column(
        String(12), default=HiringRequestStatus.pending.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=func.now(),
        server_default=func.now(),
    )
