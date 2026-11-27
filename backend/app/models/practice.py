"""Step 7p/7q practice interview models (schema.sql section 8).

Approved differences from schema.sql:
- practice_drills.prompts and practice_drills.rubric use portable JSON.
- practice_sessions adds target_role, focus_area, difficulty, question_count,
  questions (JSON), and deleted_at (soft delete).
- practice_transcript_turns adds nullable question_index.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PracticeDrill(Base):
    __tablename__ = "practice_drills"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", server_default="medium"
    )
    duration_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompts: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    rubric: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict, server_default=text("'{}'")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("difficulty IN ('easy','medium','hard')", name="practice_difficulty_valid"),
        CheckConstraint(
            "duration_min IS NULL OR duration_min > 0", name="practice_duration_valid"
        ),
        Index("practice_drills_category_idx", "category", postgresql_where=text("is_active")),
    )


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    drill_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("practice_drills.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus_area: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[str] = mapped_column(
        String(16), nullable=False, default="medium", server_default="medium"
    )
    question_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=3, server_default="3"
    )
    questions: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="scheduled", server_default="scheduled"
    )
    score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clarity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    structure: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    empathy: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    technical_rigor: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_video_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    confidence_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    body_language_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    communication_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    turns: Mapped[list["PracticeTranscriptTurn"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PracticeTranscriptTurn.id",
    )

    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('easy','medium','hard')",
            name="practice_session_difficulty_valid",
        ),
        CheckConstraint(
            "question_count BETWEEN 1 AND 15",
            name="practice_session_question_count_valid",
        ),
        CheckConstraint(
            "status IN ('scheduled','in_progress','completed','abandoned')",
            name="practice_session_status_valid",
        ),
        CheckConstraint("score IS NULL OR score BETWEEN 0 AND 100", name="practice_session_score_valid"),
        CheckConstraint(
            "duration_sec IS NULL OR duration_sec >= 0",
            name="practice_session_duration_valid",
        ),
        CheckConstraint(
            "clarity IS NULL OR clarity BETWEEN 0 AND 100",
            name="practice_session_clarity_valid",
        ),
        CheckConstraint(
            "structure IS NULL OR structure BETWEEN 0 AND 100",
            name="practice_session_structure_valid",
        ),
        CheckConstraint(
            "empathy IS NULL OR empathy BETWEEN 0 AND 100",
            name="practice_session_empathy_valid",
        ),
        CheckConstraint(
            "technical_rigor IS NULL OR technical_rigor BETWEEN 0 AND 100",
            name="practice_session_technical_rigor_valid",
        ),
        CheckConstraint(
            "confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100",
            name="practice_session_confidence_valid",
        ),
        CheckConstraint(
            "body_language_score IS NULL OR body_language_score BETWEEN 0 AND 100",
            name="practice_session_body_language_valid",
        ),
        CheckConstraint(
            "communication_score IS NULL OR communication_score BETWEEN 0 AND 100",
            name="practice_session_communication_valid",
        ),
        Index(
            "practice_sessions_user_idx",
            "user_id",
            "created_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class PracticeTranscriptTurn(Base):
    __tablename__ = "practice_transcript_turns"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("practice_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    question_index: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session: Mapped[PracticeSession] = relationship(back_populates="turns")

    __table_args__ = (
        CheckConstraint("speaker IN ('interviewer','candidate')", name="practice_turn_speaker_valid"),
        Index("practice_turns_session_idx", "session_id", "id"),
    )
