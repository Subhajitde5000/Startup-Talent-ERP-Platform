"""Step 7m job alerts / saved searches (job seeker).

Mirrors ``schema.sql`` ``job_alerts``: one row per saved search alert with a
``criteria`` jsonb (keywords, location, work mode, salary, …), a ``frequency``
enum and an ``is_active`` switch. Delivery is Step 12, so ``last_sent_at``
stays NULL until then — the row is fully usable (create/list/edit/delete) now.

``criteria`` is a JSON column (schema.sql uses jsonb; SQLite has no jsonb, and
the 5a-5l JSON-list columns already follow this rule). The structured shape is
enforced in the schema layer, not here, so the column stays a general jsonb.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AlertFrequency(enum.StrEnum):
    instant = "instant"
    daily = "daily"
    weekly = "weekly"


class JobAlert(Base):
    """A saved-search alert a seeker wants to be notified about (Step 12)."""

    __tablename__ = "job_alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    criteria: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    frequency: Mapped[AlertFrequency] = mapped_column(
        String(16), nullable=False, default=AlertFrequency.daily, server_default="daily"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    # Step 12 delivery stamp; NULL until an alert is first sent.
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="job_alert_title_check"),
        CheckConstraint(
            "frequency IN ('instant','daily','weekly')",
            name="job_alert_frequency_valid",
        ),
        # Active alerts only — the list the matcher scans in Step 12.
        Index(
            "job_alerts_user_idx",
            "user_id",
            postgresql_where=text("is_active"),
            sqlite_where=text("is_active"),
        ),
    )
