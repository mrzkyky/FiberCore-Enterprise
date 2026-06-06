"""add region and import batch to cables

Revision ID: 001_add_cable_fields
Revises: 
Create Date: 2026-06-06 13:38:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_add_cable_fields'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add columns to cables table if they don't exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('cables')]
    
    if 'region' not in columns:
        op.add_column('cables', sa.Column('region', sa.String(), nullable=True))
    if 'import_batch' not in columns:
        op.add_column('cables', sa.Column('import_batch', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('cables', 'import_batch')
    op.drop_column('cables', 'region')
