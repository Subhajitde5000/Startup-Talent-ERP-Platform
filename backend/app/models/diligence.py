"""Investor diligence models (Step 9k).

``schema.sql`` has NO tables for this step (GAP) — the shapes come
from the frontend diligence page (``/investor/startups/[id]/diligence``)
and were proposed in the approved 9k plan:

- ``investor_diligence_checklists``: one private diligence workspace
  per (investor firm, startup). Holds the overall status, the private
  team notes, and the weighted scorecard (stored as a JSON document —
  the frontend's 5-dimension scorecard with per-dimension weight,
  1-5 score and rationale).
- ``investor_diligence_items``: the checklist lines, questions to the
  founder, and findings/risks. ``item_type`` distinguishes them;
  ``severity`` applies to findings (high/medium/low/strength);
  ``status`` is a unified lifecycle vocabulary; ``response`` carries
  the founder's answer or the finding notes. Soft-deleted.

Portable-types policy: fixed vocabularies are VARCHAR + named CHECKs,
never native PG enums. The scorecard is a JSON column (portable
``JSON`` type, not PG-specific ``JSONB``).
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
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


class DiligenceOverallStatus(enum.StrEnum):
    """Overall state of a diligence workspace."""

    not_started = "not_started"
    in_progress = "in_progress"
    cleared = "cleared"
    concern = "concern"


class DiligenceItemType(enum.StrEnum):
    """What kind of diligence line an item is."""

    checklist = "checklist"
    question = "question"
    finding = "finding"


class DiligenceItemSeverity(enum.StrEnum):
    """Severity for findings (checklist/question items leave it null)."""

    high = "high"
    medium = "medium"
    low = "low"
    strength = "strength"


class DiligenceItemStatus(enum.StrEnum):
    """Unified lifecycle vocabulary for diligence items."""

    not_started = "not_started"
    in_progress = "in_progress"
    needs_info = "needs_info"
    concern = "concern"
    cleared = "cleared"
    na = "na"
    answered = "answered"
    awaiting = "awaiting"


_OVERALL_SQL = (
    "overall_status IN ('not_started','in_progress','cleared','concern')"
)
_ITEM_TYPE_SQL = "item_type IN ('checklist','question','finding')"
_SEVERITY_SQL = "severity IN ('high','medium','low','strength')"
_ITEM_STATUS_SQL = (
    "status IN ('not_started','in_progress','needs_info','concern','cleared',"
    "'na','answered','awaiting')"
)


class InvestorDiligenceChecklist(Base):
    """One private diligence workspace per (investor firm, startup) (9k)."""

    __tablename__ = "investor_diligence_checklists"

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
    round_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("funding_rounds.id", ondelete="SET NULL"),
        nullable=True,
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_deals.id", ondelete="SET NULL"),
        nullable=True,
    )
    overall_status: Mapped[DiligenceOverallStatus] = mapped_column(
        SAEnum(
            DiligenceOverallStatus,
            name="diligence_overall_status",
            native_enum=False,
            length=16,
        ),
        nullable=False,
        default=DiligenceOverallStatus.not_started,
        server_default="not_started",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scorecard: Mapped[dict | None] = mapped_column(JSON, nullable=True)
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
        CheckConstraint(_OVERALL_SQL, name="diligence_overall_status_valid"),
        Index(
            "investor_diligence_checklists_unique",
            "investor_org_id",
            "startup_org_id",
            unique=True,
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_diligence_checklists_investor_idx",
            "investor_org_id",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_diligence_checklists_startup_idx",
            "startup_org_id",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
    )


class InvestorDiligenceItem(Base):
    """A checklist line, question, or finding within a workspace (9k)."""

    __tablename__ = "investor_diligence_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    checklist_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_diligence_checklists.id", ondelete="CASCADE"),
        nullable=False,
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
    item_type: Mapped[DiligenceItemType] = mapped_column(
        SAEnum(
            DiligenceItemType, name="diligence_item_type", native_enum=False, length=16
        ),
        nullable=False,
        default=DiligenceItemType.checklist,
        server_default="checklist",
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[DiligenceItemSeverity | None] = mapped_column(
        SAEnum(
            DiligenceItemSeverity,
            name="diligence_item_severity",
            native_enum=False,
            length=16,
        ),
        nullable=True,
    )
    status: Mapped[DiligenceItemStatus] = mapped_column(
        SAEnum(
            DiligenceItemStatus,
            name="diligence_item_status",
            native_enum=False,
            length=16,
        ),
        nullable=False,
        default=DiligenceItemStatus.not_started,
        server_default="not_started",
    )
    due_on: Mapped[date | None] = mapped_column(nullable=True)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        CheckConstraint(_ITEM_TYPE_SQL, name="diligence_item_type_valid"),
        CheckConstraint(_SEVERITY_SQL, name="diligence_item_severity_valid"),
        CheckConstraint(_ITEM_STATUS_SQL, name="diligence_item_status_valid"),
        CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="diligence_item_title_check",
        ),
        Index(
            "investor_diligence_items_checklist_idx",
            "checklist_id",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_diligence_items_investor_idx",
            "investor_org_id",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
    )


__all__ = [
    "DiligenceItemSeverity",
    "DiligenceItemStatus",
    "DiligenceItemType",
    "DiligenceOverallStatus",
    "InvestorDiligenceChecklist",
    "InvestorDiligenceItem",
]
