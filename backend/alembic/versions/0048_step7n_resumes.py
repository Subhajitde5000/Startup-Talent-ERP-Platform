"""Step 7n only: resume builder tables and talent_profiles.resume_id FK.

Tables:
- ``resumes``: job-seeker owned resumes with soft-delete, single default partial unique index,
  ``template`` (nullable hint) and ``source`` (default 'manual').
  Omits ``file_id``, ``view_count``, ``download_count`` per approved plan.
- ``resume_experiences``: ordered work history entries with portable JSON ``bullets``.
- ``resume_education``: ordered education entries.
- ``resume_skills``: join to global ``skills`` table (ON DELETE RESTRICT).
- ``talent_profiles_resume_fk``: deferred FK from ``talent_profiles.resume_id`` to ``resumes.id``.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "0048_step7n_resumes"
down_revision = "0047_step7lm_saved_alerts"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resumes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("target_role", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("template", sa.String(length=64), nullable=True),
        sa.Column(
            "source",
            sa.String(length=16),
            nullable=False,
            server_default="manual",
        ),
        sa.Column("ats_score", sa.SmallInteger(), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "source IN ('manual','profile','ai','import')",
            name="resumes_source_check",
        ),
        sa.CheckConstraint(
            "ats_score IS NULL OR (ats_score >= 0 AND ats_score <= 100)",
            name="resumes_ats_score_check",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "resumes_one_default",
        "resumes",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default AND deleted_at IS NULL"),
        sqlite_where=sa.text("is_default AND deleted_at IS NULL"),
    )
    op.create_index(
        "resumes_user_idx",
        "resumes",
        ["user_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "resume_experiences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("role_title", sa.Text(), nullable=False),
        sa.Column("company", sa.Text(), nullable=False),
        sa.Column("period_label", sa.Text(), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=True),
        sa.Column("ended_on", sa.Date(), nullable=True),
        sa.Column(
            "bullets",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "display_order",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("display_order >= 0", name="resume_experiences_order_check"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "resume_experiences_resume_idx",
        "resume_experiences",
        ["resume_id", "display_order"],
        unique=False,
    )

    op.create_table(
        "resume_education",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("degree", sa.Text(), nullable=False),
        sa.Column("school", sa.Text(), nullable=False),
        sa.Column("year_label", sa.Text(), nullable=True),
        sa.Column(
            "display_order",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("display_order >= 0", name="resume_education_order_check"),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "resume_education_resume_idx",
        "resume_education",
        ["resume_id", "display_order"],
        unique=False,
    )

    op.create_table(
        "resume_skills",
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("resume_id", "skill_id"),
    )

    with op.batch_alter_table("talent_profiles") as batch_op:
        batch_op.create_foreign_key(
            "talent_profiles_resume_fk",
            "resumes",
            ["resume_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("talent_profiles") as batch_op:
        batch_op.drop_constraint("talent_profiles_resume_fk", type_="foreignkey")

    op.drop_table("resume_skills")
    op.drop_index("resume_education_resume_idx", table_name="resume_education")
    op.drop_table("resume_education")
    op.drop_index("resume_experiences_resume_idx", table_name="resume_experiences")
    op.drop_table("resume_experiences")
    op.drop_index("resumes_user_idx", table_name="resumes")
    op.drop_index("resumes_one_default", table_name="resumes")
    op.drop_table("resumes")
