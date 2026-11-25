"""Step 7f interviews, participants and panel feedback.

Reference: ``database/schema.sql`` sections ``interviews``,
``interview_participants`` and ``interview_feedback``. Documented
deviations (also in the 0041 migration):

- ``format``/``status``/``side``/``response``/``recommendation`` are
  String columns + named CHECKs instead of PostgreSQL enum types — same
  treatment as ``jobs.status`` and ``job_applications.stage``.
- ``updated_at`` on participants and feedback (AGENTS.md section 6;
  0039 did the same for ``application_notes``).
- Partial UNIQUE ``(interview_id, author_id)`` on ``interview_feedback``
  (author_id IS NOT NULL): one feedback row per panelist, upserted on
  re-submit. schema.sql allows duplicates.
- ``interview_participants_user_idx``: the composite PK cannot serve
  participant-first lookups (respond check, "needs my feedback").

``interviews`` has no ``org_id`` — the organization is reached through
``application_id -> job_applications.job_id -> jobs.org_id``, exactly as
in schema.sql.
"""

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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

INTERVIEW_FORMATS = "'video','phone','onsite','async'"
INTERVIEW_STATUSES = "'scheduled','confirmed','completed','cancelled','no_show','rescheduled'"
PARTICIPANT_SIDES = "'interviewer','candidate','observer'"
PARTICIPANT_RESPONSES = "'accepted','declined','tentative'"
FEEDBACK_RECOMMENDATIONS = "'strong_yes','yes','no','strong_no'"


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE")
    )
    round_name: Mapped[str | None] = mapped_column(String(100))
    format: Mapped[str] = mapped_column(String(16), default="video", server_default="video")
    status: Mapped[str] = mapped_column(String(16), default="scheduled", server_default="scheduled")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_min: Mapped[int] = mapped_column(SmallInteger, default=45, server_default="45")
    location: Mapped[str | None] = mapped_column(String(500))
    meeting_url: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    cancelled_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"format IN ({INTERVIEW_FORMATS})", name="interviews_format_check"),
        CheckConstraint(f"status IN ({INTERVIEW_STATUSES})", name="interviews_status_check"),
        CheckConstraint("duration_min BETWEEN 5 AND 480", name="interviews_duration_check"),
        CheckConstraint(
            "round_name IS NULL OR length(trim(round_name)) BETWEEN 1 AND 100",
            name="interviews_round_check",
        ),
        CheckConstraint(
            "location IS NULL OR length(trim(location)) BETWEEN 1 AND 500",
            name="interviews_location_check",
        ),
        CheckConstraint(
            "meeting_url IS NULL OR length(trim(meeting_url)) BETWEEN 1 AND 500",
            name="interviews_meeting_url_check",
        ),
        CheckConstraint(
            "cancelled_reason IS NULL OR length(trim(cancelled_reason)) BETWEEN 1 AND 500",
            name="interviews_cancelled_reason_check",
        ),
        Index("interviews_app_idx", "application_id", text("scheduled_at DESC")),
        Index(
            "interviews_upcoming_idx",
            "scheduled_at",
            postgresql_where=text("status IN ('scheduled','confirmed')"),
            sqlite_where=text("status IN ('scheduled','confirmed')"),
        ),
    )


class InterviewParticipant(Base):
    __tablename__ = "interview_participants"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interviews.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    side: Mapped[str] = mapped_column(
        String(16), default="interviewer", server_default="interviewer"
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"side IN ({PARTICIPANT_SIDES})", name="interview_participants_side_check"),
        CheckConstraint(
            f"response IS NULL OR response IN ({PARTICIPANT_RESPONSES})",
            name="interview_participants_response_check",
        ),
        CheckConstraint(
            "(response IS NULL AND responded_at IS NULL) OR "
            "(response IS NOT NULL AND responded_at IS NOT NULL)",
            name="interview_participants_responded_check",
        ),
        Index("interview_participants_user_idx", "user_id"),
    )


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    interview_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    recommendation: Mapped[str | None] = mapped_column(String(16))
    summary: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            f"recommendation IS NULL OR recommendation IN ({FEEDBACK_RECOMMENDATIONS})",
            name="interview_feedback_recommendation_check",
        ),
        CheckConstraint(
            "summary IS NULL OR length(trim(summary)) BETWEEN 1 AND 5000",
            name="interview_feedback_summary_check",
        ),
        Index("interview_feedback_interview_idx", "interview_id"),
        Index(
            "interview_feedback_author_unique",
            "interview_id",
            "author_id",
            unique=True,
            postgresql_where=text("author_id IS NOT NULL"),
            sqlite_where=text("author_id IS NOT NULL"),
        ),
    )
