"""Step 7d: private notes, scoped assignment/rejection and job blind-review settings.

Existing applications stay non-blind. Legacy rejected records, if any, retain
unknown rejection metadata; new API rejections always populate both fields.
"""

import sqlalchemy as sa

from alembic import op

revision = "0039_step7d_applicant_pipeline"
down_revision = "0038_step7c_applications"
branch_labels = None
depends_on = None

REJECTION_CHECK = (
    "(rejected_reason IS NULL AND rejected_at IS NULL) OR "
    "(stage = 'rejected' AND rejected_reason IS NOT NULL AND rejected_at IS NOT NULL "
    "AND length(trim(rejected_reason)) BETWEEN 1 AND 1100)"
)


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("blind_review_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Batch operations preserve the repository's SQLite supplemental-test support.
    with op.batch_alter_table("job_applications") as batch:
        batch.add_column(sa.Column("assignee_id", sa.Uuid(), nullable=True))
        batch.add_column(
            sa.Column("is_blind", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(sa.Column("rejected_reason", sa.Text(), nullable=True))
        batch.add_column(sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_foreign_key(
            "job_applications_assignee_fk", "users", ["assignee_id"], ["id"], ondelete="SET NULL"
        )
        batch.create_check_constraint("job_applications_rejection_check", REJECTION_CHECK)
        batch.create_index("ix_job_applications_assignee_id", ["assignee_id"])
        batch.create_index("job_applications_job_created_idx", ["job_id", "created_at", "id"])
        batch.create_index(
            "job_applications_job_assignee_idx", ["job_id", "assignee_id", "created_at", "id"]
        )
    op.create_table(
        "application_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "length(trim(body)) BETWEEN 1 AND 5000", name="application_notes_body_check"
        ),
    )
    op.create_index("ix_application_notes_author_id", "application_notes", ["author_id"])
    op.create_index(
        "application_notes_app_idx",
        "application_notes",
        ["application_id", "author_id", "created_at", "id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("application_notes")
    with op.batch_alter_table("job_applications") as batch:
        batch.drop_index("job_applications_job_assignee_idx")
        batch.drop_index("job_applications_job_created_idx")
        batch.drop_index("ix_job_applications_assignee_id")
        batch.drop_constraint("job_applications_rejection_check", type_="check")
        batch.drop_constraint("job_applications_assignee_fk", type_="foreignkey")
        batch.drop_column("rejected_at")
        batch.drop_column("rejected_reason")
        batch.drop_column("is_blind")
        batch.drop_column("assignee_id")
    op.drop_column("jobs", "blind_review_enabled")
