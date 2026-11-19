"""Readiness models (Step 5f, schema.sql "startup profile and readiness").

Two tables, both mirroring schema.sql:

``readiness_criteria``
    Reference data: the six checklist items rendered by
    ``/startup/readiness``. Bootstrapped by ``scripts/bootstrap_readiness.py``
    (idempotent by ``code``) — never seeded from a migration.

``startup_readiness``
    One row per (organization, criterion). ``org_id`` references
    ``startup_profiles.org_id`` (not ``organizations.id``) exactly as
    schema.sql does, so a startup always has a profile row before it can
    carry readiness state; the service creates that profile on demand
    (the 5a ``_ensure_profile`` pattern).

Plan decisions carried by this module:
- D1: the score is computed from a query over *active* criteria, so the
  schema.sql ``v_startup_readiness`` view is deliberately not created
  (it divides by touched rows and yields NULL for a fresh startup).
- D3: ``signed_off_by`` is stamped from the authenticated actor only.
- D4: ``score`` (per-criterion, ``score_100`` in schema.sql) is kept as a
  nullable reserved column and is never written in 5f — unweighted
  scoring has no per-criterion number to store.
- D6: ``evidence`` is a single text column (overwritten on resubmit);
  Step 4 (uploads) is deferred, so no file reference is invented.
- 5i D1: ``is_exit_criterion`` splits the table in two audiences. The six
  readiness items (``False``) feed ``readiness_score``; the 25 stage exit
  criteria (``True``) are the per-stage checklists and are EXCLUDED from
  that score, so adding them cannot move a single 5f percentage.

Portable types: ``status`` is VARCHAR + the named CHECK from schema.sql
(``startup_readiness_status_valid``); ``stage`` uses the same
``Enum(native_enum=False)`` policy as ``startup_profiles.stage``
(5a/0006), i.e. VARCHAR(16), so it round-trips as a ``StartupStage``;
``score`` is SmallInteger + CHECK instead of the ``score_100`` domain
(domains are not portable to SQLite).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.startup import StartupStage


class ReadinessStatus(enum.StrEnum):
    """schema.sql CHECK on ``startup_readiness.status``."""

    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    signed_off = "signed_off"
    rejected = "rejected"


class ReadinessCriterion(Base):
    """Reference checklist item (the six rows on /startup/readiness)."""

    __tablename__ = "readiness_criteria"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Stable machine key (plan D2); unique so the bootstrap is idempotent.
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Same policy as startup_profiles.stage (5a/0006): VARCHAR(16) with
    # the Python enum attached, no native PG type and no second CHECK.
    stage: Mapped[StartupStage | None] = mapped_column(
        SAEnum(StartupStage, name="startup_stage", native_enum=False, length=16),
        nullable=True,
    )
    # Reserved: unweighted scoring in 5f ignores this (plan D1).
    weight: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1, server_default="1"
    )
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    # 5i D1: exit criteria are readiness rows too (one source of truth,
    # tasks can link to them via startup_readiness.id) but they never
    # count towards readiness_score. Default False keeps every 5f row
    # exactly as it was.
    is_exit_criterion: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
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
        UniqueConstraint("code", name="readiness_criteria_code_key"),
        CheckConstraint("weight > 0", name="readiness_criteria_weight_check"),
    )


class StartupReadiness(Base):
    """Per (organization, criterion) readiness state.

    Holds the state of BOTH kinds of criterion: the six readiness items
    and the 25 stage exit criteria. The same state machine, evidence and
    admin sign-off apply; only the score denominator differs (5i D1).
    """

    __tablename__ = "startup_readiness"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # schema.sql references startup_profiles(org_id): a startup profile is
    # the precondition for readiness state (created on demand by the service).
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("readiness_criteria.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[ReadinessStatus] = mapped_column(
        String(16),
        nullable=False,
        default=ReadinessStatus.not_started,
        server_default="not_started",
    )
    # Plan D6: free text (the schema gives us one column, no history table).
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Plan D4: reserved for a future weighted rubric; never written in 5f.
    score: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
        info={"check": "score >= 0 AND score <= 100"},
    )
    # Plan D3: always the authenticated admin actor, never client input.
    signed_off_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    signed_off_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        UniqueConstraint(
            "org_id", "criterion_id", name="startup_readiness_unique"
        ),
        CheckConstraint(
            "status IN ('not_started','in_progress','submitted',"
            "'signed_off','rejected')",
            name="startup_readiness_status_valid",
        ),
        CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 100)",
            name="startup_readiness_score_check",
        ),
    )
