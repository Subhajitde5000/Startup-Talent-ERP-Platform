"""Audit/activity log (Step 3d item 8; schema.sql section "activity_events").

Appendix-only log for sensitive organization actions. Written by
``activity_service.record()`` inside the SAME transaction as the action it
describes, so an audit row can never exist without its change (or the
reverse).

Deviations from schema.sql (documented, follow the existing policy):
- ``id`` stays a bigint identity on PostgreSQL (append-only log table,
  AGENTS.md section 6) but degrades to INTEGER on SQLite, which only
  autoincrements an INTEGER PRIMARY KEY — same treatment as
  ``login_attempts``. ``with_variant`` keeps the production type correct.
- ``metadata`` is a JSON column (schema.sql uses jsonb); SQLite has no
  jsonb, and the 5a-5l JSON-list columns already follow this rule.
- No ``updated_at``: the table is insert-only by design, so a mutation
  timestamp would be dead weight. This matches schema.sql.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ActivityEventType(enum.StrEnum):
    """The team actions Step 3d item 8 requires an audit row for.

    A fixed vocabulary (AGENTS.md section 6) so a typo cannot silently
    invent a new event category. Later steps append their own members.
    """

    role_changed = "role_changed"
    member_deactivated = "member_deactivated"
    member_reactivated = "member_reactivated"
    member_removed = "member_removed"
    ownership_transferred = "ownership_transferred"
    invite_created = "invite_created"
    invite_resent = "invite_resent"
    invite_revoked = "invite_revoked"
    # Step 5d (approved D-9b): comments are user content an admin may
    # delete, so creation and deletion get an audit row. Editing is left
    # out deliberately — the edited flag is visible on the comment itself
    # (updated_at > created_at) and every edit would double the feed.
    task_commented = "task_commented"
    task_comment_deleted = "task_comment_deleted"


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    # nullable: an event may belong to the platform rather than an org
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
    )
    # SET NULL keeps the audit trail when a user account is deleted; the
    # summary text still says what happened.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    link_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Both feed a reverse-chronological feed ("what happened in this
        # org", "what did this person do") — schema.sql has the same two.
        Index("activity_events_org_idx", "org_id", created_at.desc()),
        Index("activity_events_user_idx", "user_id", created_at.desc()),
    )
