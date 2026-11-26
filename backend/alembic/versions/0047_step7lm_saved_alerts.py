"""Step 7m only: saved jobs and job alerts (job seeker).

Two tables back the job-seeker "Saved jobs" and "Alerts" pages.

- ``saved_jobs`` mirrors schema.sql ``(user_id, job_id, created_at)`` with a
  composite PK, plus the ``note`` column approved as a 7l/7m GAP (the
  /jobseeker/saved page keeps a private per-job note that must persist).
- ``job_alerts`` mirrors schema.sql exactly: title, criteria jsonb, frequency
  enum, is_active, last_sent_at (NULL until Step 12 delivery). ``criteria`` is
  a portable JSON column (schema.sql uses jsonb; SQLite has no jsonb, and the
  5a-5l JSON columns already follow this rule).

``v_job_funnel`` (also named for 7l) is deliberately NOT created here: the
funnel is computed in ``employer_hiring_service`` from the ``jobs`` and
``job_applications`` tables so it is portable and testable under the
``create_all`` harness, which cannot emit SQL views. See the 7l/7m plan (G1).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "0047_step7lm_saved_alerts"
down_revision = "0046_step7i_request_form_fields"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_jobs",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "job_id"),
    )
    op.create_index(
        "saved_jobs_user_idx", "saved_jobs", ["user_id", sa.text("created_at DESC")], unique=False
    )
    op.create_index("saved_jobs_job_idx", "saved_jobs", ["job_id"], unique=False)

    op.create_table(
        "job_alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("criteria", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column(
            "frequency",
            sa.String(16),
            nullable=False,
            server_default="daily",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="job_alert_title_check"),
        sa.CheckConstraint(
            "frequency IN ('instant','daily','weekly')",
            name="job_alert_frequency_valid",
        ),
    )
    op.create_index(
        "job_alerts_user_idx",
        "job_alerts",
        ["user_id"],
        postgresql_where=sa.text("is_active"),
        sqlite_where=sa.text("is_active"),
    )


def downgrade() -> None:
    op.drop_index("job_alerts_user_idx", table_name="job_alerts")
    op.drop_table("job_alerts")
    op.drop_index("saved_jobs_job_idx", table_name="saved_jobs")
    op.drop_index("saved_jobs_user_idx", table_name="saved_jobs")
    op.drop_table("saved_jobs")
