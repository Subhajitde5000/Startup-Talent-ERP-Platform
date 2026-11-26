"""Step 7g: job offers and platform-seeded decline reasons.

Reference: database/schema.sql sections ``job_offers`` (lines 984-1005)
and ``offer_decline_reasons`` (lines 1890-1903). Deviations, matching the
model module docstrings (plan-approved):

- ``status`` stays VARCHAR with a named CHECK instead of the native PG
  ``offer_status`` enum (portable-types policy — SQLite has no native
  enums; the CHECK carries the same guarantee). The enum *values* are
  identical to schema.sql's ``offer_status``.
- One live offer per application (plan D10): a partial UNIQUE on
  ``application_id`` restricted to draft/sent/countered, where schema.sql
  had only the plain index. The model does NOT add schema.sql's plain
  unique on application_id — history rows keep their application_id after
  going terminal, so a bare unique would forbid a second offer on the
  same application ever.
- ``org_id`` is not a column: reachable through application -> job -> org
  (plan: no org_id on job_offers).
- CHECKs beyond schema.sql: money >= 0, equity 0-100, upper-case
  currency (plan: "currency VARCHAR(3) upper CHECK"), and
  ``decline_reason_id IS NULL OR status = 'declined'`` (plan D5: only a
  declined offer carries a reason).
- ``offer_decline_reasons`` rows are seeded through a documented
  bootstrap command (plan D5); no data is inserted here.
"""

import sqlalchemy as sa

from alembic import op

revision = "0042_step7g_offers"
down_revision = "0041_step7f_interviews"
branch_labels = None
depends_on = None

# schema.sql offer_status, verbatim.
OFFER_STATUSES = "'draft','sent','countered','accepted','declined','expired','withdrawn'"


def upgrade() -> None:
    # Created first: job_offers.decline_reason_id references it
    # (schema.sql section 13 adds the FK after both tables exist).
    op.create_table(
        "offer_decline_reasons",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "job_offers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        # schema.sql: numeric(14,2), nullable (the API requires it on
        # create; the column stays nullable to match the reference).
        sa.Column("base_salary", sa.Numeric(14, 2), nullable=True),
        sa.Column("bonus_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("equity_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("joining_bonus", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "currency", sa.String(3), nullable=False, server_default="INR"
        ),
        # schema.sql: date, nullable (the API requires it on create).
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column(
            "status", sa.String(16), nullable=False, server_default="draft"
        ),
        sa.Column(
            "owner_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "document_file_id",
            sa.Uuid(),
            sa.ForeignKey("files.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "decline_reason_id",
            sa.Uuid(),
            sa.ForeignKey("offer_decline_reasons.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "base_salary IS NULL OR base_salary >= 0",
            name="job_offers_base_salary_check",
        ),
        sa.CheckConstraint(
            "bonus_amount IS NULL OR bonus_amount >= 0",
            name="job_offers_bonus_check",
        ),
        sa.CheckConstraint(
            "equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)",
            name="job_offers_equity_check",
        ),
        sa.CheckConstraint(
            "joining_bonus IS NULL OR joining_bonus >= 0",
            name="job_offers_joining_bonus_check",
        ),
        sa.CheckConstraint(
            "currency = upper(currency)", name="job_offers_currency_check"
        ),
        sa.CheckConstraint(
            f"status IN ({OFFER_STATUSES})", name="job_offers_status_check"
        ),
        sa.CheckConstraint(
            "decline_reason_id IS NULL OR status = 'declined'",
            name="job_offers_decline_reason_check",
        ),
    )
    # schema.sql: job_offers_application_idx (application_id, created_at DESC).
    op.create_index(
        "job_offers_application_idx",
        "job_offers",
        ["application_id", sa.text("created_at DESC")],
    )
    op.create_index("job_offers_status_idx", "job_offers", ["status"],
                    postgresql_where=sa.text("deleted_at IS NULL"),
                    sqlite_where=sa.text("deleted_at IS NULL"))
    # Plan D10: exactly one live (draft/sent/countered) offer per
    # application; terminal history rows stay visible but cannot collide.
    op.create_index(
        "job_offers_live_unique",
        "job_offers",
        ["application_id"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('draft','sent','countered') AND deleted_at IS NULL"
        ),
        sqlite_where=sa.text(
            "status IN ('draft','sent','countered') AND deleted_at IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("job_offers_live_unique", table_name="job_offers")
    op.drop_index("job_offers_status_idx", table_name="job_offers")
    op.drop_index("job_offers_application_idx", table_name="job_offers")
    op.drop_table("job_offers")
    op.drop_table("offer_decline_reasons")
