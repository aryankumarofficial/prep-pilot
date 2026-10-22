"""link target job to roadmap priorities

Revision ID: 94cf4cb08721
Revises: 85352cd51914
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "94cf4cb08721"
down_revision: Union[str, Sequence[str], None] = "85352cd51914"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("roadmap_versions", sa.Column("job_title", sa.String(length=160), nullable=True))
    with op.batch_alter_table("roadmaps") as batch:
        batch.add_column(sa.Column("job_description_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_roadmaps_target_job", "job_descriptions", ["job_description_id"], ["id"], ondelete="SET NULL"
        )


def downgrade():
    with op.batch_alter_table("roadmaps") as batch:
        batch.drop_constraint("fk_roadmaps_target_job", type_="foreignkey")
        batch.drop_column("job_description_id")
    op.drop_column("roadmap_versions", "job_title")
