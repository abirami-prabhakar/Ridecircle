from alembic import context
from app.database import engine, Base
from app import models

if context.is_offline_mode():
    raise RuntimeError("Run migrations with a live PostGIS database")
else:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
