"""Scoped hiring workflow revision. Downgrade deletes only this phase's data.

Static schema and operational decline vocabulary from the existing applicant design.
No application-model imports or demo offers.
"""

import uuid

import sqlalchemy as sa

from alembic import op

revision = "0042_step7g_job_offers"
down_revision = "0041_step7f_interviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "offer_decline_reasons",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "job_offers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("base_salary", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("bonus_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("equity_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("joining_bonus", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("salary_period", sa.String(length=16), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("submitted_by", sa.UUID(), nullable=True),
        sa.Column("document_file_id", sa.UUID(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decline_reason_id", sa.Uuid(), nullable=True),
        sa.Column("decline_detail", sa.String(length=1000), nullable=True),
        sa.Column("counter_note", sa.String(length=2000), nullable=True),
        sa.Column("parent_offer_id", sa.Uuid(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("terms_version", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("job_snapshot", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(currency) = 3 AND currency = upper(currency) AND salary_period IN ('annual','monthly')",
            name="job_offers_currency_check",
        ),
        sa.CheckConstraint(
            "status IN ('draft','sent','countered','accepted','declined','expired','withdrawn')",
            name="job_offers_status_check",
        ),
        sa.CheckConstraint(
            "base_salary > 0 AND (bonus_amount IS NULL OR bonus_amount >= 0) AND (joining_bonus IS NULL OR joining_bonus >= 0)",
            name="job_offers_money_check",
        ),
        sa.CheckConstraint(
            "equity_pct IS NULL OR equity_pct BETWEEN 0 AND 100", name="job_offers_equity_check"
        ),
        sa.CheckConstraint(
            "version > 0 AND terms_version > 0 AND expires_on < start_date",
            name="job_offers_dates_check",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["job_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["decline_reason_id"], ["offer_decline_reasons.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["document_file_id"], ["files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_offer_id"], ["job_offers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_job_offers_application_id"), "job_offers", ["application_id"], unique=False
    )
    op.create_index(
        op.f("ix_job_offers_document_file_id"), "job_offers", ["document_file_id"], unique=False
    )
    op.create_index(
        op.f("ix_job_offers_parent_offer_id"), "job_offers", ["parent_offer_id"], unique=False
    )
    op.create_index(op.f("ix_job_offers_status"), "job_offers", ["status"], unique=False)
    op.create_index(
        "job_offers_live_key",
        "job_offers",
        ["application_id"],
        unique=True,
        postgresql_where=sa.text(
            "deleted_at IS NULL AND superseded_at IS NULL AND status IN ('draft','sent','countered','accepted')"
        ),
        sqlite_where=sa.text(
            "deleted_at IS NULL AND superseded_at IS NULL AND status IN ('draft','sent','countered','accepted')"
        ),
    )
    op.create_index(
        "job_offers_retry_key", "job_offers", ["application_id", "request_id"], unique=True
    )
    op.create_index(
        "job_offers_version_key", "job_offers", ["application_id", "terms_version"], unique=True
    )
    op.create_table(
        "job_offer_approvals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("offer_id", sa.Uuid(), nullable=False),
        sa.Column("approver_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("note", sa.String(length=1000), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected')", name="job_offer_approvals_status_check"
        ),
        sa.ForeignKeyConstraint(["approver_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["offer_id"], ["job_offers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_job_offer_approvals_approver_id"),
        "job_offer_approvals",
        ["approver_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_job_offer_approvals_offer_id"), "job_offer_approvals", ["offer_id"], unique=False
    )
    op.create_index(
        "job_offer_approvals_actor_key",
        "job_offer_approvals",
        ["offer_id", "approver_id"],
        unique=True,
    )

    reasons = sa.table(
        "offer_decline_reasons",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("label", sa.String()),
    )
    op.bulk_insert(
        reasons,
        [
            {"id": uuid.UUID(id_), "code": code, "label": label}
            for id_, code, label in (
                ("df4fb871-2914-59b6-ae39-bcb68b9f3ee4", "another_offer", "Accepted another offer"),
                ("70985334-b2fd-58c9-81fe-19e7f8fb906e", "compensation", "Compensation"),
                ("047e0d48-e9c7-5440-bc3e-7b497a418e79", "role", "Role"),
                ("7ddd7578-ba84-51c6-8bf3-658250dda4d5", "location_mode", "Location or mode"),
                ("b3c18a56-3ce4-5e2a-94ec-073e657b39ff", "company", "Company"),
                ("884302da-f200-5991-ba05-626f26156211", "timing", "Timing"),
                ("f3160f4d-d859-5914-86f7-d415ad756334", "other", "Other"),
            )
        ],
    )


def downgrade() -> None:
    op.drop_table("job_offer_approvals")
    op.drop_table("job_offers")
    op.drop_table("offer_decline_reasons")
