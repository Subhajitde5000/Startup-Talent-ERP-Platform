"""Step 7i: hiring_requests plus the deferred jobs.request_id link.

Reference: database/schema.sql lines 715-734 (hiring_requests) and the
``jobs.request_id`` column declared at line 739 — 7a's migration 0035
deliberately deferred that FK "until hiring_requests exists (7i)", which
is now.

Deviations, matching the model module docstring:

- ``role_title``/``urgency``/``status`` are VARCHAR with the schema.sql
  CHECKs (portable-types policy; schema.sql already defined the CHECKs
  on ``text``/``department``-style columns).
- ``department`` is String(16) + named CHECK over schema.sql's native
  ``department`` enum values (same policy as 7h's hires.department).
- Extra index ``jobs_request_idx`` on the new FK: the request detail
  reads the converted job back through ``jobs.request_id`` (AGENTS.md
  section 6 wants FK indexes; schema.sql does not declare one).
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0044_step7i_hiring_requests"
down_revision = "0043_step7h_hires"
branch_labels = None
depends_on = None

# schema.sql department enum, verbatim (matches Department StrEnum).
DEPARTMENTS = (
    "'engineering','product','design','sales','marketing','operations',"
    "'finance','people','legal','support','other'"
)
# schema.sql hiring_request_urgency_valid, verbatim.
URGENCIES = "'low','normal','high','urgent'"
# schema.sql hiring_request_status_valid, verbatim.
REQUEST_STATUSES = "'draft','pending','approved','rejected','fulfilled','cancelled'"


def upgrade() -> None:
    op.create_table(
        "hiring_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role_title", sa.String(160), nullable=False),
        sa.Column("department", sa.String(16), nullable=True),
        sa.Column(
            "headcount", sa.SmallInteger(), nullable=False, server_default="1"
        ),
        sa.Column(
            "urgency", sa.String(8), nullable=False, server_default="normal"
        ),
        sa.Column(
            "requested_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "approver_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_start", sa.Date(), nullable=True),
        sa.Column("budget_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "currency", sa.String(3), nullable=False, server_default="INR"
        ),
        sa.Column(
            "status", sa.String(12), nullable=False, server_default="pending"
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
        sa.CheckConstraint("headcount > 0", name="hiring_request_headcount_check"),
        sa.CheckConstraint(
            f"urgency IN ({URGENCIES})", name="hiring_request_urgency_valid"
        ),
        sa.CheckConstraint(
            f"status IN ({REQUEST_STATUSES})", name="hiring_request_status_valid"
        ),
        sa.CheckConstraint(
            f"department IS NULL OR department IN ({DEPARTMENTS})",
            name="hiring_requests_department_check",
        ),
    )
    op.create_index(
        "hiring_requests_org_idx", "hiring_requests", ["org_id", "status"]
    )

    # 7a's deferred link: approved requests convert into jobs.
    with op.batch_alter_table("jobs") as batch:
        batch.add_column(
            sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True)
        )
        batch.create_foreign_key(
            "jobs_request_id_fkey",
            "hiring_requests",
            ["request_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_index("jobs_request_idx", ["request_id"])


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch:
        batch.drop_index("jobs_request_idx")
        batch.drop_constraint("jobs_request_id_fkey", type_="foreignkey")
        batch.drop_column("request_id")
    op.drop_index("hiring_requests_org_idx", table_name="hiring_requests")
    op.drop_table("hiring_requests")
