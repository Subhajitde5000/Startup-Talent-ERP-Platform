"""Step 7t (phase B): startup hiring page fields the API lacked.

/startup/hiring/requests/new and /startup/hiring/employer-page collect
values with no home in the 7i/5a tables. Approved GAP: fix the API rather
than fake the fields in the frontend. Seed data never lives here (the
dev-only seed script holds it).

- ``hiring_requests.why_now`` CHECK gains ``stage_plan`` (the startup
  form's "Stage plan" driver).
- ``hiring_requests.stage_criterion_id``: optional FK to a Step 5i stage
  exit criterion (``readiness_criteria``) ON DELETE SET NULL + index
  (AGENTS.md section 6 FK-index rule). Startup organizations only
  (service-enforced, 422 otherwise).
- ``startup_profiles.mission``: TEXT, the employer page's "Mission" line.
"""

import sqlalchemy as sa

from alembic import op

revision = "0052_step7t_hiring_fields"
down_revision = "0051_video_interview_scores"
branch_labels = None
depends_on = None

WHY_NOW_OLD = "'growth','replacement','new_project','skill_gap'"
WHY_NOW_NEW = "'growth','replacement','new_project','skill_gap','stage_plan'"


def upgrade() -> None:
    with op.batch_alter_table("hiring_requests") as batch:
        batch.drop_constraint("hiring_requests_why_now_check", type_="check")
        batch.create_check_constraint(
            "hiring_requests_why_now_check",
            f"why_now IS NULL OR why_now IN ({WHY_NOW_NEW})",
        )
        batch.add_column(sa.Column("stage_criterion_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "hiring_requests_stage_criterion_id_fkey",
            "readiness_criteria",
            ["stage_criterion_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_index("hiring_requests_stage_criterion_idx", ["stage_criterion_id"])
    with op.batch_alter_table("startup_profiles") as batch:
        batch.add_column(sa.Column("mission", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("startup_profiles") as batch:
        batch.drop_column("mission")
    op.execute("UPDATE hiring_requests SET why_now = NULL WHERE why_now = 'stage_plan'")
    with op.batch_alter_table("hiring_requests") as batch:
        batch.drop_index("hiring_requests_stage_criterion_idx")
        batch.drop_constraint("hiring_requests_stage_criterion_id_fkey", type_="foreignkey")
        batch.drop_column("stage_criterion_id")
        batch.drop_constraint("hiring_requests_why_now_check", type_="check")
        batch.create_check_constraint(
            "hiring_requests_why_now_check",
            f"why_now IS NULL OR why_now IN ({WHY_NOW_OLD})",
        )
