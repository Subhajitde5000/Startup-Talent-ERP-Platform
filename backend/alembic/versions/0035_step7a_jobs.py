"""Step 7a only: jobs, skill links and benefits.

Approved differences from reference: visibility, salary period/public toggle,
structured description sections, updated_at on child tables, defensive checks
and FK/page indexes. request_id is deferred until hiring_requests exists (7i).
String-backed checked enums and the composite skill key follow existing code.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0035_step7a_jobs"
down_revision: str | None = "0034_step9h_data_room_access"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("responsibilities", sa.Text()),
        sa.Column("requirements", sa.Text()),
        sa.Column("what_we_offer", sa.Text()),
        sa.Column("department", sa.String(16)),
        sa.Column("location", sa.String(200)),
        sa.Column("work_mode", sa.String(16), nullable=False, server_default="onsite"),
        sa.Column("employment_type", sa.String(16), nullable=False, server_default="full_time"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("visibility", sa.String(32), nullable=False, server_default="public"),
        sa.Column("salary_min", sa.Numeric(14, 2)),
        sa.Column("salary_max", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("salary_period", sa.String(16), nullable=False, server_default="annual"),
        sa.Column(
            "show_salary_publicly", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("equity_min_pct", sa.Numeric(5, 2)),
        sa.Column("equity_max_pct", sa.Numeric(5, 2)),
        sa.Column("experience_min_yrs", sa.SmallInteger()),
        sa.Column("experience_max_yrs", sa.SmallInteger()),
        sa.Column("openings", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("featured_until", sa.DateTime(timezone=True)),
        sa.Column("posted_at", sa.DateTime(timezone=True)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="jobs_title_check"),
        sa.CheckConstraint(
            "status IN ('draft','open','paused','closed')", name="jobs_status_check"
        ),
        sa.CheckConstraint(
            "work_mode IN ('onsite','hybrid','remote')", name="jobs_work_mode_check"
        ),
        sa.CheckConstraint(
            "employment_type IN ('full_time','part_time','contract','internship','temporary')",
            name="jobs_employment_type_check",
        ),
        sa.CheckConstraint(
            "visibility IN ('public','platform_members','link_only')", name="jobs_visibility_check"
        ),
        sa.CheckConstraint(
            "salary_period IN ('annual','monthly')", name="jobs_salary_period_check"
        ),
        sa.CheckConstraint(
            "department IS NULL OR department IN ('engineering','product','design','sales','marketing','operations','finance','people','legal','support','other')",
            name="jobs_department_check",
        ),
        sa.CheckConstraint(
            "length(currency) = 3 AND currency = upper(currency)", name="jobs_currency_check"
        ),
        sa.CheckConstraint(
            "(salary_min IS NULL OR salary_min >= 0) AND (salary_max IS NULL OR salary_max >= 0)",
            name="jobs_salary_nonnegative",
        ),
        sa.CheckConstraint(
            "salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min",
            name="jobs_salary_range",
        ),
        sa.CheckConstraint(
            "(equity_min_pct IS NULL OR equity_min_pct BETWEEN 0 AND 100) AND (equity_max_pct IS NULL OR equity_max_pct BETWEEN 0 AND 100)",
            name="jobs_equity_bounds",
        ),
        sa.CheckConstraint(
            "equity_min_pct IS NULL OR equity_max_pct IS NULL OR equity_max_pct >= equity_min_pct",
            name="jobs_equity_range",
        ),
        sa.CheckConstraint(
            "(experience_min_yrs IS NULL OR experience_min_yrs >= 0) AND (experience_max_yrs IS NULL OR experience_max_yrs >= 0)",
            name="jobs_experience_nonnegative",
        ),
        sa.CheckConstraint(
            "experience_min_yrs IS NULL OR experience_max_yrs IS NULL OR experience_max_yrs >= experience_min_yrs",
            name="jobs_experience_range",
        ),
        sa.CheckConstraint("openings > 0", name="jobs_openings_check"),
        sa.CheckConstraint(
            "status <> 'open' OR posted_at IS NOT NULL", name="jobs_open_has_posted"
        ),
    )
    live = sa.text("deleted_at IS NULL")
    op.create_index(
        "jobs_org_status_idx",
        "jobs",
        ["org_id", "status"],
        postgresql_where=live,
        sqlite_where=live,
    )
    # Stable organization-scoped newest-first pagination without a full sort.
    op.create_index(
        "jobs_org_created_idx",
        "jobs",
        ["org_id", "created_at", "id"],
        postgresql_where=live,
        sqlite_where=live,
    )
    feed = sa.text("status = 'open' AND deleted_at IS NULL")
    op.create_index(
        "jobs_open_feed_idx",
        "jobs",
        [sa.text("posted_at DESC")],
        postgresql_where=feed,
        sqlite_where=feed,
    )
    op.create_index(
        "jobs_mode_idx",
        "jobs",
        ["work_mode", "employment_type"],
        postgresql_where=sa.text("status = 'open'"),
        sqlite_where=sa.text("status = 'open'"),
    )
    op.create_index("ix_jobs_owner_id", "jobs", ["owner_id"])
    op.create_index("ix_jobs_created_by", "jobs", ["created_by"])
    op.create_table(
        "job_skills",
        sa.Column(
            "job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "skill_id", sa.Uuid(), sa.ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
        ),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("job_skills_skill_idx", "job_skills", ["skill_id"])
    op.create_table(
        "job_benefits",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("display_order", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "length(trim(label)) BETWEEN 1 AND 100", name="job_benefits_label_check"
        ),
        sa.CheckConstraint("display_order >= 0", name="job_benefits_order_check"),
    )
    op.create_index("job_benefits_job_idx", "job_benefits", ["job_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )
        op.execute(
            "CREATE TRIGGER job_skills_set_updated_at BEFORE UPDATE ON job_skills FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )
        op.execute(
            "CREATE TRIGGER job_benefits_set_updated_at BEFORE UPDATE ON job_benefits FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
        )


def downgrade() -> None:
    op.drop_table("job_benefits")
    op.drop_table("job_skills")
    op.drop_table("jobs")
