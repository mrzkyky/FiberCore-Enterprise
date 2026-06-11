"""add import batch to devices

Revision ID: 003
Revises: 002
Create Date: 2026-06-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('devices', sa.Column('import_batch', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('devices', 'import_batch')
