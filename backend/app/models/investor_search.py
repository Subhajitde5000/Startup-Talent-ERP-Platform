"""Investor search models (Step 9d: preferences, saved searches, shortlist).

Mirrors migration 0025 / the approved 9d table proposal. ``schema.sql``
has no tables for this step (GAP), so the shapes come from the frontend
pages they serve:

- ``/investor/profile/edit`` collects the investment thesis: sectors,
  stage focus, ticket size range (the page comments say these "stay demo
  until Step 9") plus an investor sub-type for the 9b directory.
- ``/investor/searches`` stores named re-runnable filter sets.
- ``/investor/shortlist`` keeps bookmarked startups with a private note
  and a review status.

Portable-type policy (same as the rest of the project): the
``investor_type`` / ``shortlist_status`` fixed sets are VARCHAR + named
CHECKs, never native PG enums; money is ``NUMERIC(14,2)``; lists are
JSON (the ``startup_profiles.ecosystem_goals`` pattern).
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InvestorType(enum.StrEnum):
    """Investor sub-type (9b directory "Type" filter).

    ``schema.sql`` defines no investor type anywhere; the directory's
    Type filter (Angel / Angel group / Fund) needs one, so it is stored
    on ``investor_preferences`` (9d plan D1).
    """

    angel = "angel"
    angel_group = "angel_group"
    fund = "fund"
    other = "other"


class ShortlistStatus(enum.StrEnum):
    """Review status shown on the shortlist page."""

    new = "new"
    reviewing = "reviewing"
    follow_up = "follow_up"
    waiting_for_startup = "waiting_for_startup"


_INVESTOR_TYPE_SQL = "investor_type IS NULL OR investor_type IN ('angel','angel_group','fund','other')"
_SHORTLIST_STATUS_SQL = (
    "status IN ('new','reviewing','follow_up','waiting_for_startup')"
)


class InvestorPreference(Base):
    """One row per investor firm: the investment thesis filters."""

    __tablename__ = "investor_preferences"

    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    investor_type: Mapped[InvestorType | None] = mapped_column(
        String(16), nullable=True
    )
    sectors: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    stage_focus: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    min_ticket: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    max_ticket: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
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

    __table_args__ = (
        CheckConstraint(_INVESTOR_TYPE_SQL, name="investor_type_valid"),
        CheckConstraint(
            "min_ticket IS NULL OR min_ticket > 0",
            name="investor_preferences_min_ticket_check",
        ),
        CheckConstraint(
            "max_ticket IS NULL OR max_ticket > 0",
            name="investor_preferences_max_ticket_check",
        ),
    )


class SavedSearch(Base):
    """A named, re-runnable copy of the 9c discovery filter set."""

    __tablename__ = "saved_searches"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Whitelisted 9c filter keys only (validated by the schema): stage,
    # sector, city, q, raise_min, raise_max, investment_ready_only.
    criteria: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict, server_default="{}"
    )
    is_active: Mapped[bool] = mapped_column(
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="saved_searches_name_check",
        ),
        Index(
            "saved_searches_org_idx",
            "investor_org_id",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


class ShortlistEntry(Base):
    """A startup bookmarked by an investor, with private note/status."""

    __tablename__ = "shortlist_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Same reference style as ``investor_deals`` (9e): the target must
    # be a startup with a profile row.
    startup_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ShortlistStatus] = mapped_column(
        String(24),
        nullable=False,
        default=ShortlistStatus.new,
        server_default="new",
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
        CheckConstraint(_SHORTLIST_STATUS_SQL, name="shortlist_status_valid"),
        CheckConstraint(
            "investor_org_id <> startup_org_id",
            name="shortlist_distinct_parties",
        ),
        Index(
            "shortlist_entries_investor_idx",
            "investor_org_id",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "shortlist_entries_unique",
            "investor_org_id",
            "startup_org_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


__all__ = [
    "InvestorPreference",
    "InvestorType",
    "SavedSearch",
    "ShortlistEntry",
    "ShortlistStatus",
]
