"""Step 7b: indexed PostgreSQL full-text job discovery, no new tables."""

from alembic import op

revision = "0037_step7b_job_search"
down_revision = "0036_step7a_fair_hiring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("""CREATE INDEX jobs_discovery_fts_idx ON jobs USING gin
        (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(requirements, '')))
        WHERE deleted_at IS NULL AND status = 'open'""")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.drop_index("jobs_discovery_fts_idx", table_name="jobs")
