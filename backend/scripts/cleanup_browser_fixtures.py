"""Remove only the timestamped accounts created by this project's browser tests."""
from sqlalchemy import select, delete
from app.database import SessionLocal
from app.models import User, Profile, Route

with SessionLocal() as db:
    users=list(db.scalars(select(User).join(Profile, Profile.user_id==User.id).where(
        User.email.op("~")(r"^(explorer|mobile-map)-[0-9]{13}@example\.com$"),
        Profile.display_name.in_(["Explorer Rider","Mobile Explorer"]))))
    for user in users:
        db.execute(delete(Route).where(Route.owner_id==user.id))
        db.delete(user)
    db.commit()
    print(f"Removed {len(users)} temporary browser-test accounts.")
