"""Step 7c: self-service applications/history and bounded job application settings."""

import sqlalchemy as sa

from alembic import op

revision = "0038_step7c_applications"
down_revision = "0037_step7b_job_search"
branch_labels = None
depends_on = None

STAGES = "'applied','review','shortlisted','interview','offered','hired','rejected','withdrawn'"


def upgrade() -> None:
    op.add_column(
        "jobs", sa.Column("application_deadline", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "jobs", sa.Column("screening_questions", sa.JSON(), nullable=False, server_default="[]")
    )
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "applicant_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("stage", sa.String(16), nullable=False, server_default="applied"),
        sa.Column("source", sa.String(16), nullable=False, server_default="platform"),
        sa.Column("resume_file_id", sa.Uuid(), sa.ForeignKey("files.id", ondelete="SET NULL")),
        sa.Column("cover_note", sa.Text()),
        sa.Column("salary_expectation", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("consent_share", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("accuracy_confirmed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consent_shared_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("profile_snapshot", sa.JSON(), nullable=False),
        sa.Column("job_snapshot", sa.JSON(), nullable=False),
        sa.Column("screening_answers", sa.JSON(), nullable=False),
        sa.Column("submission_fingerprint", sa.String(64), nullable=False),
        sa.Column("stage_changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(f"stage IN ({STAGES})", name="job_applications_stage_check"),
        sa.CheckConstraint(
            "source IN ('platform','referral','marketplace','outreach','agency','other')",
            name="job_applications_source_check",
        ),
        sa.CheckConstraint(
            "salary_expectation IS NULL OR salary_expectation >= 0",
            name="job_applications_salary_check",
        ),
        sa.CheckConstraint(
            "length(currency) = 3 AND currency = upper(currency)",
            name="job_applications_currency_check",
        ),
        sa.CheckConstraint("consent_share = true", name="job_applications_consent_check"),
        sa.CheckConstraint(
            "stage <> 'withdrawn' OR withdrawn_at IS NOT NULL",
            name="job_applications_withdrawn_check",
        ),
    )
    live = sa.text("deleted_at IS NULL")
    op.create_index(
        "job_applications_unique",
        "job_applications",
        ["job_id", "applicant_id"],
        unique=True,
        postgresql_where=live,
        sqlite_where=live,
    )
    op.create_index(
        "job_applications_job_stage_idx",
        "job_applications",
        ["job_id", "stage"],
        postgresql_where=live,
        sqlite_where=live,
    )
    op.create_index(
        "job_applications_applicant_idx", "job_applications", ["applicant_id", "created_at", "id"]
    )
    op.create_index("ix_job_applications_resume_file_id", "job_applications", ["resume_file_id"])
    op.create_table(
        "application_stage_events",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            sa.Identity(),
            primary_key=True,
        ),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_stage", sa.String(16)),
        sa.Column("to_stage", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("note", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            f"to_stage IN ({STAGES}) AND (from_stage IS NULL OR from_stage IN ({STAGES}))",
            name="application_stage_events_stage_check",
        ),
    )
    op.create_index(
        "app_stage_events_app_idx",
        "application_stage_events",
        ["application_id", "created_at", "id"],
    )
    op.create_index("app_stage_events_actor_idx", "application_stage_events", ["actor_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "CREATE TRIGGER job_applications_updated_at BEFORE UPDATE ON job_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )


def downgrade() -> None:
    op.drop_table("application_stage_events")
    op.drop_table("job_applications")
    op.drop_column("jobs", "screening_questions")
    op.drop_column("jobs", "application_deadline")
