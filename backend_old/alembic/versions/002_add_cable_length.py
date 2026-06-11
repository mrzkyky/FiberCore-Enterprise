"""add cable length

Revision ID: 002
Revises: 001
Create Date: 2026-06-08 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_add_cable_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cables', sa.Column('length', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('cables', 'length')
