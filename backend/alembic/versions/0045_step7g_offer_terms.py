"""Optional actual contractual terms displayed by the 7g UI; no sample defaults."""

import sqlalchemy as sa

from alembic import op

revision = "0045_step7g_offer_terms"
down_revision = "0044_step7h_documents"
branch_labels = None
depends_on = None

FIELDS = (
    "payment_terms",
    "bonus_terms",
    "probation_terms",
    "notice_terms",
    "vesting_terms",
    "exercise_price_terms",
    "joining_bonus_terms",
)


def upgrade() -> None:
    for name in FIELDS:
        op.add_column("job_offers", sa.Column(name, sa.String(2000), nullable=True))


def downgrade() -> None:
    for name in reversed(FIELDS):
        op.drop_column("job_offers", name)
