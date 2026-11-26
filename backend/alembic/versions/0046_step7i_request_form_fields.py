"""Step 7i (phase B): hiring-request form fields the page needs.

/employer/requests/new collects employment type, work mode, a hiring
manager, required skills, a "why now" driver and a justification; the
schema.sql ``hiring_requests`` table (lines 715-734) has no home for
them. Approved GAP: fix the API rather than fake the fields in the
frontend. Seed data never lives here (dev-only seed script instead).

- ``employment_type`` / ``work_mode``: VARCHAR + CHECK over the job enum
  values (carried into the draft job on convert).
- ``hiring_manager_id``: FK users ON DELETE SET NULL + index (AGENTS.md
  section 6 FK-index rule) -> the converted job's ``owner_id``.
- ``skills``: JSON list of skill names (portable — talent-profile
  precedent), resolved against the catalogue on convert.
- ``why_now``: VARCHAR + CHECK; ``justification``: TEXT (internal only).
"""

import sqlalchemy as sa

from alembic import op

revision = "0046_step7i_request_form_fields"
down_revision = "0045_step7j_talent_sourcing"
branch_labels = None
depends_on = None

EMPLOYMENT_TYPES = "'full_time','part_time','contract','internship','temporary'"
WORK_MODES = "'onsite','hybrid','remote'"
WHY_NOW = "'growth','replacement','new_project','skill_gap'"


def upgrade() -> None:
    with op.batch_alter_table("hiring_requests") as batch:
        batch.add_column(
            sa.Column(
                "employment_type",
                sa.String(12),
                nullable=False,
                server_default="full_time",
            )
        )
        batch.add_column(
            sa.Column("work_mode", sa.String(8), nullable=False, server_default="onsite")
        )
        batch.add_column(sa.Column("hiring_manager_id", sa.Uuid(), nullable=True))
        batch.add_column(
            sa.Column("skills", sa.JSON(), nullable=False, server_default="[]")
        )
        batch.add_column(sa.Column("why_now", sa.String(12), nullable=True))
        batch.add_column(sa.Column("justification", sa.Text(), nullable=True))
        batch.create_foreign_key(
            "hiring_requests_hiring_manager_id_fkey",
            "users",
            ["hiring_manager_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_check_constraint(
            "hiring_requests_employment_type_check",
            f"employment_type IN ({EMPLOYMENT_TYPES})",
        )
        batch.create_check_constraint(
            "hiring_requests_work_mode_check", f"work_mode IN ({WORK_MODES})"
        )
        batch.create_check_constraint(
            "hiring_requests_why_now_check",
            f"why_now IS NULL OR why_now IN ({WHY_NOW})",
        )
        batch.create_index("hiring_requests_hiring_manager_idx", ["hiring_manager_id"])


def downgrade() -> None:
    with op.batch_alter_table("hiring_requests") as batch:
        batch.drop_index("hiring_requests_hiring_manager_idx")
        batch.drop_constraint("hiring_requests_why_now_check", type_="check")
        batch.drop_constraint("hiring_requests_work_mode_check", type_="check")
        batch.drop_constraint("hiring_requests_employment_type_check", type_="check")
        batch.drop_constraint("hiring_requests_hiring_manager_id_fkey", type_="foreignkey")
        batch.drop_column("justification")
        batch.drop_column("why_now")
        batch.drop_column("skills")
        batch.drop_column("hiring_manager_id")
        batch.drop_column("work_mode")
        batch.drop_column("employment_type")
