"""7j: talent shortlists and outreach history (schema.sql 812-831 plus
the approved ``talent_outreach`` GAP table).

Deviations from schema.sql (portable-types policy):

- ``talent_shortlists.name`` is String(160) (schema.sql ``text``); the
  API validates 1-120 characters.
- Extra index on the members FK ``user_id`` (AGENTS.md section 6 wants
  FK indexes; schema.sql declares none — the composite PK already
  covers ``shortlist_id`` lookups).
- ``talent_outreach`` is not in schema.sql at all: it is the 7j plan's
  approved GAP table. Status (pending/applied) is DERIVED from
  job_applications at read time, never stored — no status CHECK exists
  here for that reason.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TalentShortlist(Base):
    """An org-scoped list of candidates (soft-deleted via deleted_at)."""

    __tablename__ = "talent_shortlists"
    __table_args__ = (
        Index(
            "talent_shortlists_org_idx",
            "org_id",
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(160))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )


class TalentShortlistMember(Base):
    """Composite PK (shortlist_id, user_id) exactly as schema.sql."""

    __tablename__ = "talent_shortlist_members"
    __table_args__ = (
        Index("talent_shortlist_members_user_idx", "user_id"),
    )

    shortlist_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("talent_shortlists.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    added_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TalentOutreach(Base):
    """One row per invite-to-apply send (approved GAP table).

    UNIQUE(org_id, candidate_user_id, job_id): one live invite per
    candidate per job per org — duplicates become 409 in the service.
    """

    __tablename__ = "talent_outreach"
    __table_args__ = (
        UniqueConstraint(
            "org_id",
            "candidate_user_id",
            "job_id",
            name="talent_outreach_unique",
        ),
        Index("talent_outreach_org_idx", "org_id", text("created_at DESC")),
        Index("talent_outreach_sent_idx", "sent_by", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    candidate_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE")
    )
    note: Mapped[str | None] = mapped_column(String(2000), default=None)
    sent_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
