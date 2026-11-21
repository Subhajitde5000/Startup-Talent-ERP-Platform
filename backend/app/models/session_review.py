"""Reviews of completed mentoring sessions (Step 8i)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SessionReview(Base):
    __tablename__ = "session_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mentoring_sessions.id", ondelete="CASCADE"), nullable=False
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    public_text: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    private_feedback: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    public_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    anonymous: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("session_id", "reviewer_id", name="session_reviews_session_reviewer_key"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="session_reviews_rating_check"),
        CheckConstraint(
            "public_text IS NULL OR length(public_text) <= 2000",
            name="session_reviews_public_text_check",
        ),
        CheckConstraint(
            "private_feedback IS NULL OR length(private_feedback) <= 2000",
            name="session_reviews_private_feedback_check",
        ),
        Index("session_reviews_reviewer_idx", "reviewer_id"),
    )
