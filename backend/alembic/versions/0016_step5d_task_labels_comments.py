"""Step 5d: task labels, label links and comments.

Revision ID: 0016_step5d_task_labels_comments
Revises: 0015_step3d_team_management
Create Date: 2026-11-16

Three new tables, no data and no row rewrites, so ``downgrade`` is a clean
drop:

1. ``task_labels`` — org-scoped label catalogue.
2. ``task_label_links`` — attach table (task x label).
3. ``task_comments`` — flat comments with soft delete.

Deviations from schema.sql (approved in the 5d plan, documented in the
models too):

- ``task_labels.updated_at`` exists (schema.sql has only ``created_at``).
  AGENTS.md section 6 requires it on every table; rename/recolour is a
  real update (D-2).
- The unique name index is ``(org_id, lower(name))`` rather than
  ``(org_id, name)`` so casing cannot duplicate a label (D-1). Functional
  indexes work on PostgreSQL 16 and SQLite >= 3.9, so both test backends
  are unaffected.
- ``task_label_links`` gets ``task_label_links_label_idx`` on
  ``label_id`` — the composite PK only serves ``task_id`` lookups, while
  label deletion (FK cascade) and label filters need the reverse (D-3).
- Labels are hard-deleted; a soft-deleted label would hold its unique
  name slot forever (D-4).
- ``color`` carries no CHECK constraint: a ``~`` regex has no portable
  SQLite equivalent, so ``#RRGGBB`` is validated in Pydantic (D-5).
- ``task_comments.body`` CHECK uses ``trim()`` instead of ``btrim()``
  (same policy as 0009's ``tasks_title_check``).

No data is inserted here: reference/demo rows belong to the dev seed
script, never to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016_step5d_task_labels_comments"
down_revision: str | None = "0015_step3d_team_management"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "task_labels",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("color", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        # D-2: added over schema.sql (AGENTS.md section 6).
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # D-1: lower(name) so "Backend" and "backend" are the same label.
    op.create_index(
        "task_labels_org_name_key",
        "task_labels",
        ["org_id", sa.text("lower(name)")],
        unique=True,
    )
    # FK index: every label list is "labels of this org", ordered by name.
    op.create_index("task_labels_org_idx", "task_labels", ["org_id"])

    op.create_table(
        "task_label_links",
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("label_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["label_id"], ["task_labels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("task_id", "label_id"),
    )
    # D-3: reverse direction of the composite PK (cascade + label filters).
    op.create_index("task_label_links_label_idx", "task_label_links", ["label_id"])

    op.create_table(
        "task_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "length(trim(body)) > 0", name="task_comments_body_check"
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "task_comments_task_idx",
        "task_comments",
        ["task_id", "created_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("task_comments_task_idx", table_name="task_comments")
    op.drop_table("task_comments")
    op.drop_index("task_label_links_label_idx", table_name="task_label_links")
    op.drop_table("task_label_links")
    op.drop_index("task_labels_org_idx", table_name="task_labels")
    op.drop_index("task_labels_org_name_key", table_name="task_labels")
    op.drop_table("task_labels")
