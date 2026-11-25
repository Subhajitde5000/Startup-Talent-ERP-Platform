"""Scoped hiring workflow revision. Downgrade deletes only this phase's data.

Static schema: no application-model imports and no demo data.
"""

import sqlalchemy as sa

from alembic import op

revision = "0043_step7h_onboarding"
down_revision = "0042_step7g_job_offers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "onboarding_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_platform", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
            "is_platform = false AND length(trim(name)) BETWEEN 1 AND 200",
            name="onboarding_templates_bounds_check",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_onboarding_templates_org_id"), "onboarding_templates", ["org_id"], unique=False
    )
    op.create_table(
        "onboarding_template_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("section", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("owner_role", sa.String(length=16), nullable=True),
        sa.Column("due_offset_days", sa.SmallInteger(), nullable=False),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
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
            "owner_role IS NULL OR owner_role IN ('owner','manager')",
            name="onboarding_template_items_owner_check",
        ),
        sa.CheckConstraint(
            "due_offset_days BETWEEN -365 AND 365 AND display_order BETWEEN 0 AND 49",
            name="onboarding_template_items_bounds_check",
        ),
        sa.ForeignKeyConstraint(["template_id"], ["onboarding_templates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_onboarding_template_items_template_id"),
        "onboarding_template_items",
        ["template_id"],
        unique=False,
    )
    op.create_index(
        "onboarding_template_items_order_key",
        "onboarding_template_items",
        ["template_id", "display_order"],
        unique=True,
    )
    op.create_table(
        "hires",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("offer_id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("department", sa.String(length=16), nullable=True),
        sa.Column("manager_id", sa.UUID(), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
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
            "status IN ('pending_onboarding','onboarding','active','no_show','cancelled') AND version > 0",
            name="hires_status_check",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["job_applications.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["offer_id"], ["job_offers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id"),
        sa.UniqueConstraint("offer_id"),
    )
    op.create_index(op.f("ix_hires_org_id"), "hires", ["org_id"], unique=False)
    op.create_index(op.f("ix_hires_user_id"), "hires", ["user_id"], unique=False)
    op.create_table(
        "hire_onboarding_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("hire_id", sa.Uuid(), nullable=False),
        sa.Column("section", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("note", sa.String(length=2000), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
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
            "status IN ('pending','in_progress','done','blocked','waived') AND version > 0",
            name="hire_onboarding_items_status_check",
        ),
        sa.ForeignKeyConstraint(["hire_id"], ["hires.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_hire_onboarding_items_hire_id"), "hire_onboarding_items", ["hire_id"], unique=False
    )
    op.create_index(
        op.f("ix_hire_onboarding_items_owner_id"),
        "hire_onboarding_items",
        ["owner_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("hire_onboarding_items")
    op.drop_table("hires")
    op.drop_table("onboarding_template_items")
    op.drop_table("onboarding_templates")
