"""Step 7m saved jobs (job seeker bookmarks).

``schema.sql`` defines ``saved_jobs`` as ``(user_id, job_id, created_at)``
with a composite primary key. We add a ``note`` column because the
``/jobseeker/saved`` page keeps a private per-job application note that must
persist (schema.sql has no home for it; approved GAP in the 7l/7m plan).

Portable types: UUID PKs, TEXT note, the same created_at convention as the
rest of the codebase. Indexes on the two access paths — the user's own list
(newest first) and the reverse lookup that powers "is this job saved?".
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SavedJob(Base):
    """A job a seeker has bookmarked, optionally with a private note."""

    __tablename__ = "saved_jobs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Private application-prep note. Never returned to the employer.
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        # Newest-saved first for the seeker's own list.
        Index("saved_jobs_user_idx", "user_id", created_at.desc()),
        # Reverse lookup for the "is this saved?" toggle on a job page.
        Index("saved_jobs_job_idx", "job_id"),
    )
