"""Step 8g: mentor agreements.

Revision ID: 0053_step8g_mentor_agreements
Revises: 0052_step7t_hiring_fields

One new table, ``mentor_agreements``; ``downgrade`` drops it. One row is
one version of a mentorship's written terms. Deviations from schema.sql
are approved in the 8g plan and documented on the model
(``app/models/agreement.py``): fixed sets for type/cadence, stored statuses
``draft/sent/signed/superseded/terminated`` with the calendar phase derived
at read time, added versioning/signer/end columns, ``String(3)`` currency,
and no ``document_file_id``.

No data is inserted: demo agreements belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0053_step8g_mentor_agreements"
down_revision: str | None = "0052_step7t_hiring_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "mentor_agreements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "mentorship_id",
            sa.Uuid(),
            sa.ForeignKey("mentorships.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer()),
        sa.Column(
            "previous_version_id",
            sa.Uuid(),
            sa.ForeignKey("mentor_agreements.id", ondelete="SET NULL"),
        ),
        sa.Column("proposed_by_side", sa.String(8), nullable=False),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("agreement_type", sa.String(16), nullable=False),
        sa.Column("terms", sa.Text()),
        sa.Column("equity_pct", sa.Numeric(5, 2)),
        sa.Column("fee_amount", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("cadence", sa.String(16)),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("starts_on", sa.Date()),
        sa.Column("ends_on", sa.Date()),
        sa.Column("change_reason", sa.String(500)),
        sa.Column("sent_at", _DT),
        sa.Column("mentor_signed_at", _DT),
        sa.Column("startup_signed_at", _DT),
        sa.Column(
            "startup_signed_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("ended_at", _DT),
        sa.Column("ended_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("end_reason", sa.String(500)),
        sa.Column("created_at", _DT, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", _DT, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('draft','sent','signed','superseded','terminated')",
            name="mentor_agreements_status_valid",
        ),
        sa.CheckConstraint(
            "agreement_type IN ('per_session','pro_bono')",
            name="mentor_agreements_type_valid",
        ),
        sa.CheckConstraint(
            "cadence IS NULL OR cadence IN ('weekly','fortnightly','monthly')",
            name="mentor_agreements_cadence_valid",
        ),
        sa.CheckConstraint(
            "proposed_by_side IN ('mentor','startup')", name="mentor_agreements_side_valid"
        ),
        sa.CheckConstraint("length(currency) = 3", name="mentor_agreements_currency_check"),
        sa.CheckConstraint(
            "equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)",
            name="mentor_agreements_equity_pct_check",
        ),
        sa.CheckConstraint(
            "(agreement_type = 'per_session' AND fee_amount IS NOT NULL AND fee_amount > 0)"
            " OR (agreement_type = 'pro_bono' AND fee_amount IS NULL)",
            name="mentor_agreements_fee_check",
        ),
        sa.CheckConstraint(
            "ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on",
            name="mentor_agreements_dates_check",
        ),
        sa.CheckConstraint(
            "(status = 'draft' AND version IS NULL"
            " AND mentor_signed_at IS NULL AND startup_signed_at IS NULL)"
            " OR (status <> 'draft' AND version IS NOT NULL AND version >= 1)",
            name="mentor_agreements_version_check",
        ),
        sa.CheckConstraint(
            "version IS NULL OR version = 1 OR change_reason IS NOT NULL",
            name="mentor_agreements_reason_required",
        ),
        sa.CheckConstraint(
            "status <> 'signed' OR (mentor_signed_at IS NOT NULL AND startup_signed_at IS NOT NULL)",
            name="mentor_agreements_signed_check",
        ),
        sa.CheckConstraint(
            "terms IS NULL OR length(terms) <= 10000", name="mentor_agreements_terms_check"
        ),
        sa.CheckConstraint(
            "change_reason IS NULL OR length(change_reason) BETWEEN 20 AND 500",
            name="mentor_agreements_change_reason_check",
        ),
        sa.CheckConstraint(
            "end_reason IS NULL OR length(end_reason) <= 500",
            name="mentor_agreements_end_reason_check",
        ),
        sa.UniqueConstraint("mentorship_id", "version", name="mentor_agreements_version_key"),
    )
    op.create_index(
        "mentor_agreements_mentorship_idx", "mentor_agreements", ["mentorship_id", "status"]
    )
    op.create_index(
        "mentor_agreements_one_sent",
        "mentor_agreements",
        ["mentorship_id"],
        unique=True,
        postgresql_where=sa.text("status = 'sent'"),
    )
    op.create_index(
        "mentor_agreements_one_signed",
        "mentor_agreements",
        ["mentorship_id"],
        unique=True,
        postgresql_where=sa.text("status = 'signed'"),
    )
    op.create_index(
        "mentor_agreements_one_draft_per_side",
        "mentor_agreements",
        ["mentorship_id", "proposed_by_side"],
        unique=True,
        postgresql_where=sa.text("status = 'draft'"),
    )


def downgrade() -> None:
    op.drop_index("mentor_agreements_one_draft_per_side", table_name="mentor_agreements")
    op.drop_index("mentor_agreements_one_signed", table_name="mentor_agreements")
    op.drop_index("mentor_agreements_one_sent", table_name="mentor_agreements")
    op.drop_index("mentor_agreements_mentorship_idx", table_name="mentor_agreements")
    op.drop_table("mentor_agreements")
