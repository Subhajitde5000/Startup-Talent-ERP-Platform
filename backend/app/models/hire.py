"""Hire and onboarding models (Step 7h).

``hires``, ``onboarding_templates``, ``onboarding_template_items``,
``hire_onboarding_items`` and ``hire_documents`` mirror
``database/schema.sql`` (lines 1007-1078) with the plan-approved
deviations documented in migration ``0043_step7h_hires``:

- ``department`` is String(16) + named CHECK over schema.sql's native
  ``department`` enum values (portable-types policy).
- status columns are VARCHAR + the schema.sql CHECKs.
- ``onboarding_templates.deleted_at`` added (plan D9: template
  soft-delete); ``onboarding_template_items.updated_at`` added (7f
  child-table precedent).

Lifecycle (plan D11-D14): a hire is created from an accepted/sent offer
(``application_id`` UNIQUE — one hire per application, 409 on
duplicate); status moves pending_onboarding -> onboarding -> active
with terminal no_show/cancelled. Onboarding checklist items are copied
from the chosen template at hire creation (section/title are snapshots;
owner/due dates are editable per hire). Hire documents are employer-
uploaded organization files (Step 4 files, ``FileKind.document``) with
requested -> received -> verified/rejected/expired statuses (plan D13:
no candidate upload endpoint in this step).
"""

import enum
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.organization import Department


class HireStatus(enum.StrEnum):
    """schema.sql ``hires.status`` CHECK values."""

    pending_onboarding = "pending_onboarding"
    onboarding = "onboarding"
    active = "active"
    no_show = "no_show"
    cancelled = "cancelled"


class OnboardingItemStatus(enum.StrEnum):
    """schema.sql ``hire_onboarding_items.status`` CHECK values."""

    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    blocked = "blocked"
    waived = "waived"


class HireDocumentStatus(enum.StrEnum):
    """schema.sql ``hire_documents.status`` CHECK values."""

    requested = "requested"
    received = "received"
    verified = "verified"
    rejected = "rejected"
    expired = "expired"


_HIRE_STATUSES = "'pending_onboarding','onboarding','active','no_show','cancelled'"
_ITEM_STATUSES = "'pending','in_progress','done','blocked','waived'"
_DOCUMENT_STATUSES = "'requested','received','verified','rejected','expired'"
_DEPARTMENTS = (
    "'engineering','product','design','sales','marketing','operations',"
    "'finance','people','legal','support','other'"
)


class Hire(Base):
    """One accepted candidate starting at an organization."""

    __tablename__ = "hires"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("job_applications.id", ondelete="RESTRICT"),
        nullable=False,
    )
    offer_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("job_offers.id", ondelete="SET NULL"),
        nullable=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    department: Mapped[Department | None] = mapped_column(String(16), nullable=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[HireStatus] = mapped_column(
        String(24),
        nullable=False,
        default=HireStatus.pending_onboarding,
        server_default="pending_onboarding",
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

    __table_args__ = (
        CheckConstraint(
            f"department IS NULL OR department IN ({_DEPARTMENTS})",
            name="hires_department_check",
        ),
        CheckConstraint(f"status IN ({_HIRE_STATUSES})", name="hire_status_valid"),
        Index("hires_application_key", "application_id", unique=True),
        Index("hires_org_idx", "org_id", "status"),
        Index("hires_org_start_idx", "org_id", "start_date"),
    )


class OnboardingTemplate(Base):
    """Reusable checklist template (org-scoped; platform rows future15p)."""

    __tablename__ = "onboarding_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_platform: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default="false"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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


class OnboardingTemplateItem(Base):
    """One checklist row inside a template (snapshot source)."""

    __tablename__ = "onboarding_template_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("onboarding_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    section: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    due_offset_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
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

    __table_args__ = (
        Index(
            "onboarding_template_items_tpl_idx",
            "template_id",
            "display_order",
        ),
    )


class HireOnboardingItem(Base):
    """Per-hire checklist row (copied from a template at hire creation)."""

    __tablename__ = "hire_onboarding_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hire_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hires.id", ondelete="CASCADE"),
        nullable=False,
    )
    section: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[OnboardingItemStatus] = mapped_column(
        String(16),
        nullable=False,
        default=OnboardingItemStatus.pending,
        server_default="pending",
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    __table_args__ = (
        CheckConstraint(
            f"status IN ({_ITEM_STATUSES})", name="hire_onboarding_status_valid"
        ),
        Index("hire_onboarding_hire_idx", "hire_id", "status"),
    )


class HireDocument(Base):
    """A document required from/for a hire (employer-managed, Step 4 file)."""

    __tablename__ = "hire_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hire_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hires.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(80), nullable=True)
    retention: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[HireDocumentStatus] = mapped_column(
        String(16),
        nullable=False,
        default=HireDocumentStatus.requested,
        server_default="requested",
    )
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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

    __table_args__ = (
        CheckConstraint(
            f"status IN ({_DOCUMENT_STATUSES})",
            name="hire_document_status_valid",
        ),
        Index("hire_documents_hire_idx", "hire_id", "status"),
        Index("hire_documents_file_idx", "file_id"),
    )


__all__ = [
    "Hire",
    "HireStatus",
    "OnboardingTemplate",
    "OnboardingTemplateItem",
    "OnboardingItemStatus",
    "HireOnboardingItem",
    "HireDocument",
    "HireDocumentStatus",
]
