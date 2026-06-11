"""add ports and customers

Revision ID: 004
Revises: 003
Create Date: 2026-06-08 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create ports table
    op.create_table('ports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('port_number', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('core_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['core_id'], ['cores.id'], ),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create customers table
    op.create_table('customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('service_id', sa.String(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('port_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['port_id'], ['ports.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('port_id')
    )
    op.create_index(op.f('ix_customers_service_id'), 'customers', ['service_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_customers_service_id'), table_name='customers')
    op.drop_table('customers')
    op.drop_table('ports')
