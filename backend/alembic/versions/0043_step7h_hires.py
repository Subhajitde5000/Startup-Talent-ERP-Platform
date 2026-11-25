"""Step 7h: hires, onboarding templates/items, hire checklist items and
hire documents.

Reference: database/schema.sql lines 1007-1078. Deviations, matching the
model module docstrings (plan-approved):

- ``hires.department`` is String(16) + named CHECK over schema.sql's
  native ``department`` enum values (portable-types policy — SQLite has
  no native enums; the CHECK carries the same guarantee).
- ``hires.status`` / ``hire_onboarding_items.status`` /
  ``hire_documents.status`` are VARCHAR with the schema.sql CHECKs
  (``hire_status_valid``, ``hire_onboarding_status_valid``,
  ``hire_document_status_valid``) — schema.sql already defined these
  CHECKs on ``text`` columns.
- ``onboarding_templates.deleted_at`` added (plan D9: template
  soft-delete; schema.sql has no deleted_at).
- ``onboarding_template_items.updated_at`` added (plan table list; the
  7f child-table ``updated_at`` precedent).
- Extra index ``hires_org_start_idx`` (org_id, start_date) and
  ``hire_documents_file_idx`` (file_id) from the plan's index list.
"""

import sqlalchemy as sa

from alembic import op

revision = "0043_step7h_hires"
down_revision = "0042_step7g_offers"
branch_labels = None
depends_on = None

# schema.sql department enum, verbatim (matches Department StrEnum).
DEPARTMENTS = (
    "'engineering','product','design','sales','marketing','operations',"
    "'finance','people','legal','support','other'"
)
# schema.sql hire_status_valid, verbatim.
HIRE_STATUSES = "'pending_onboarding','onboarding','active','no_show','cancelled'"
# schema.sql hire_onboarding_status_valid, verbatim.
ITEM_STATUSES = "'pending','in_progress','done','blocked','waived'"
# schema.sql hire_document_status_valid, verbatim.
DOCUMENT_STATUSES = "'requested','received','verified','rejected','expired'"


def upgrade() -> None:
    op.create_table(
        "hires",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("job_applications.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "offer_id",
            sa.Uuid(),
            sa.ForeignKey("job_offers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("department", sa.String(16), nullable=True),
        sa.Column(
            "manager_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "owner_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.String(24),
            nullable=False,
            server_default="pending_onboarding",
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
        sa.CheckConstraint(
            f"department IS NULL OR department IN ({DEPARTMENTS})",
            name="hires_department_check",
        ),
        sa.CheckConstraint(
            f"status IN ({HIRE_STATUSES})", name="hire_status_valid"
        ),
    )
    # schema.sql: hires_application_key, hires_org_idx.
    op.create_index("hires_application_key", "hires", ["application_id"], unique=True)
    op.create_index("hires_org_idx", "hires", ["org_id", "status"])
    # Plan index list: (org_id, start_date).
    op.create_index("hires_org_start_idx", "hires", ["org_id", "start_date"])

    op.create_table(
        "onboarding_templates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "is_platform", sa.Boolean(), nullable=False, server_default=sa.false()
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
    )

    op.create_table(
        "onboarding_template_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "template_id",
            sa.Uuid(),
            sa.ForeignKey("onboarding_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section", sa.String(80), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("owner_role", sa.String(16), nullable=True),
        sa.Column("due_offset_days", sa.SmallInteger(), nullable=True),
        sa.Column(
            "display_order",
            sa.SmallInteger(),
            nullable=False,
            server_default="0",
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
    # schema.sql: onboarding_template_items_tpl_idx.
    op.create_index(
        "onboarding_template_items_tpl_idx",
        "onboarding_template_items",
        ["template_id", "display_order"],
    )

    op.create_table(
        "hire_onboarding_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "hire_id",
            sa.Uuid(),
            sa.ForeignKey("hires.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section", sa.String(80), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column(
            "owner_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column(
            "status", sa.String(16), nullable=False, server_default="pending"
        ),
        sa.Column("note", sa.Text(), nullable=True),
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
            f"status IN ({ITEM_STATUSES})",
            name="hire_onboarding_status_valid",
        ),
    )
    # schema.sql: hire_onboarding_hire_idx.
    op.create_index(
        "hire_onboarding_hire_idx",
        "hire_onboarding_items",
        ["hire_id", "status"],
    )

    op.create_table(
        "hire_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "hire_id",
            sa.Uuid(),
            sa.ForeignKey("hires.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "file_id",
            sa.Uuid(),
            sa.ForeignKey("files.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("purpose", sa.String(80), nullable=True),
        sa.Column("retention", sa.String(80), nullable=True),
        sa.Column(
            "status", sa.String(16), nullable=False, server_default="requested"
        ),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column(
            "requested_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
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
        sa.CheckConstraint(
            f"status IN ({DOCUMENT_STATUSES})",
            name="hire_document_status_valid",
        ),
    )
    # schema.sql: hire_documents_hire_idx; plan adds the file_id lookup.
    op.create_index(
        "hire_documents_hire_idx", "hire_documents", ["hire_id", "status"]
    )
    op.create_index("hire_documents_file_idx", "hire_documents", ["file_id"])


def downgrade() -> None:
    op.drop_index("hire_documents_file_idx", table_name="hire_documents")
    op.drop_index("hire_documents_hire_idx", table_name="hire_documents")
    op.drop_table("hire_documents")
    op.drop_index("hire_onboarding_hire_idx", table_name="hire_onboarding_items")
    op.drop_table("hire_onboarding_items")
    op.drop_index(
        "onboarding_template_items_tpl_idx", table_name="onboarding_template_items"
    )
    op.drop_table("onboarding_template_items")
    op.drop_table("onboarding_templates")
    op.drop_index("hires_org_start_idx", table_name="hires")
    op.drop_index("hires_org_idx", table_name="hires")
    op.drop_index("hires_application_key", table_name="hires")
    op.drop_table("hires")
