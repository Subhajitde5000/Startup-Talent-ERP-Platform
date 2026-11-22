"""Step 9f — investor engagement (requests + meetings)

GAP tables (no schema.sql precedent — shapes approved in the plan):
``investor_engagement_requests`` is the ask/answer flow between an
investor firm and a startup; ``investor_meetings`` is the scheduled
event, optionally linked to a request and/or a 9e deal.

Revision ID: 0029_step9f_engagement
Revises: 0028_step9j_commit_portfolio
Create Date: 2026-11-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0029_step9f_engagement"
down_revision: str | None = "0028_step9j_commit_portfolio"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "investor_engagement_requests",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_org_id", _UUID, nullable=False),
        sa.Column("startup_org_id", _UUID, nullable=False),
        sa.Column("deal_id", _UUID, nullable=True),
        sa.Column("kind", sa.String(16), nullable=False, server_default="intro"),
        sa.Column("ask", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("response_note", sa.Text, nullable=True),
        sa.Column("decline_reason", sa.Text, nullable=True),
        sa.Column("expires_on", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", _UUID, nullable=True),
        sa.Column("created_by", _UUID, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["investor_deals.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "kind IN ('intro','meeting','information')",
            name="engagement_request_kind_valid",
        ),
        sa.CheckConstraint(
            "status IN ('pending','accepted','declined','withdrawn','expired')",
            name="engagement_request_status_valid",
        ),
        sa.CheckConstraint(
            "length(trim(ask)) BETWEEN 1 AND 200",
            name="engagement_request_ask_check",
        ),
    )
    op.create_index(
        "investor_engagement_requests_unique",
        "investor_engagement_requests",
        ["investor_org_id", "startup_org_id", "kind"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND status IN ('pending','accepted')"),
        sqlite_where=sa.text("deleted_at IS NULL AND status IN ('pending','accepted')"),
    )
    op.create_index(
        "investor_engagement_requests_investor_idx",
        "investor_engagement_requests",
        ["investor_org_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "investor_engagement_requests_startup_idx",
        "investor_engagement_requests",
        ["startup_org_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "investor_meetings",
        sa.Column("id", _UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_org_id", _UUID, nullable=False),
        sa.Column("startup_org_id", _UUID, nullable=False),
        sa.Column("request_id", _UUID, nullable=True),
        sa.Column("deal_id", _UUID, nullable=True),
        sa.Column("meeting_type", sa.String(16), nullable=False, server_default="intro_call"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.SmallInteger, nullable=False, server_default="30"),
        sa.Column("agenda", sa.Text, nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="proposed"),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("organizer_org_id", _UUID, nullable=False),
        sa.Column("created_by", _UUID, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["investor_engagement_requests.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["investor_deals.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["organizer_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "meeting_type IN ('intro_call','pitch','diligence','follow_up','other')",
            name="meeting_type_valid",
        ),
        sa.CheckConstraint(
            "status IN ('proposed','confirmed','cancelled','completed')",
            name="meeting_status_valid",
        ),
        sa.CheckConstraint(
            "duration_minutes >= 15 AND duration_minutes <= 480",
            name="meeting_duration_check",
        ),
        sa.CheckConstraint(
            "organizer_org_id IN (investor_org_id, startup_org_id)",
            name="meeting_organizer_valid",
        ),
    )
    op.create_index(
        "investor_meetings_investor_idx",
        "investor_meetings",
        ["investor_org_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "investor_meetings_startup_idx",
        "investor_meetings",
        ["startup_org_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "investor_meetings_scheduled_idx", "investor_meetings", ["scheduled_at"]
    )


def downgrade() -> None:
    op.drop_index("investor_meetings_scheduled_idx", table_name="investor_meetings")
    op.drop_index("investor_meetings_startup_idx", table_name="investor_meetings")
    op.drop_index("investor_meetings_investor_idx", table_name="investor_meetings")
    op.drop_table("investor_meetings")
    op.drop_index("investor_engagement_requests_startup_idx", table_name="investor_engagement_requests")
    op.drop_index("investor_engagement_requests_investor_idx", table_name="investor_engagement_requests")
    op.drop_index("investor_engagement_requests_unique", table_name="investor_engagement_requests")
    op.drop_table("investor_engagement_requests")
