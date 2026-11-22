"""Step 9k — investor diligence (checklists + items)

GAP tables (no schema.sql precedent — shapes approved in the plan):
``investor_diligence_checklists`` is one private diligence workspace
per (investor firm, startup) with an overall status, private notes and
a JSON scorecard; ``investor_diligence_items`` holds the checklist
lines, questions and findings with a unified status vocabulary.

Revision ID: 0030_step9k_diligence
Revises: 0029_step9f_engagement
Create Date: 2026-11-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0030_step9k_diligence"
down_revision: str | None = "0029_step9f_engagement"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "investor_diligence_checklists",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_org_id", _UUID, nullable=False),
        sa.Column("startup_org_id", _UUID, nullable=False),
        sa.Column("round_id", _UUID, nullable=True),
        sa.Column("deal_id", _UUID, nullable=True),
        sa.Column("overall_status", sa.String(16), nullable=False, server_default="not_started"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("scorecard", sa.JSON, nullable=True),
        sa.Column("owner_id", _UUID, nullable=True),
        sa.Column("created_by", _UUID, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["round_id"], ["funding_rounds.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["investor_deals.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "overall_status IN ('not_started','in_progress','cleared','concern')",
            name="diligence_overall_status_valid",
        ),
    )
    op.create_index(
        "investor_diligence_checklists_unique",
        "investor_diligence_checklists",
        ["investor_org_id", "startup_org_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "investor_diligence_checklists_investor_idx",
        "investor_diligence_checklists",
        ["investor_org_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "investor_diligence_checklists_startup_idx",
        "investor_diligence_checklists",
        ["startup_org_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "investor_diligence_items",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("checklist_id", _UUID, nullable=False),
        sa.Column("investor_org_id", _UUID, nullable=False),
        sa.Column("startup_org_id", _UUID, nullable=False),
        sa.Column("item_type", sa.String(16), nullable=False, server_default="checklist"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("severity", sa.String(16), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="not_started"),
        sa.Column("due_on", sa.Date, nullable=True),
        sa.Column("response", sa.Text, nullable=True),
        sa.Column("owner_id", _UUID, nullable=True),
        sa.Column("created_by", _UUID, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["checklist_id"],
            ["investor_diligence_checklists.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "item_type IN ('checklist','question','finding')",
            name="diligence_item_type_valid",
        ),
        sa.CheckConstraint(
            "severity IS NULL OR severity IN ('high','medium','low','strength')",
            name="diligence_item_severity_valid",
        ),
        sa.CheckConstraint(
            "status IN ('not_started','in_progress','needs_info','concern',"
            "'cleared','na','answered','awaiting')",
            name="diligence_item_status_valid",
        ),
        sa.CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="diligence_item_title_check",
        ),
    )
    op.create_index(
        "investor_diligence_items_checklist_idx",
        "investor_diligence_items",
        ["checklist_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "investor_diligence_items_investor_idx",
        "investor_diligence_items",
        ["investor_org_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("investor_diligence_items_investor_idx", table_name="investor_diligence_items")
    op.drop_index("investor_diligence_items_checklist_idx", table_name="investor_diligence_items")
    op.drop_table("investor_diligence_items")
    op.drop_index("investor_diligence_checklists_startup_idx", table_name="investor_diligence_checklists")
    op.drop_index("investor_diligence_checklists_investor_idx", table_name="investor_diligence_checklists")
    op.drop_index("investor_diligence_checklists_unique", table_name="investor_diligence_checklists")
    op.drop_table("investor_diligence_checklists")
