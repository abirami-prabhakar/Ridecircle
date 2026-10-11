"""Idempotent fixtures: real destinations, explicitly fictional people and rides."""
import secrets
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from .database import SessionLocal
from .models import User, Profile, Spot, Event, RSVP, Route
from .auth import password_hash
from .discovery import point

SPOTS = [
    ("Marina Beach", "beach", 13.05, 80.2824, ["coast", "photography", "exploration"], "A coastal destination on Chennai’s Bay of Bengal shoreline.", "https://en.wikipedia.org/wiki/Marina_Beach"),
    ("Semmozhi Poonga", "park", 13.05238, 80.25104, ["nature", "photography"], "A botanical garden near Cathedral Road. Treat this as a destination, not a cycling route inside the garden.", "https://www.wikidata.org/wiki/Q12068695"),
    ("Guindy National Park", "park", 13.00259, 80.23079, ["nature", "exploration"], "A protected green space in Guindy. Confirm visitor access and bicycle rules before planning a visit.", "https://en.wikipedia.org/wiki/Guindy_National_Park"),
]


def seed():
    with SessionLocal() as db:
        for name, category, lat, lon, tags, description, source in SPOTS:
            if not db.scalar(select(Spot).where(Spot.name == name)):
                db.add(Spot(name=name, category=category, location=point(lat, lon), tags=tags, description=description,
                            source_url=source, source_note="Curated public geographic record; representative location, not a verified entrance. Access, opening hours, road conditions and bicycle permissions are unverified."))
        route_file = Path(__file__).parent / "data" / "chennai-garden-coast.geojson"
        if route_file.exists():
            feature = json.loads(route_file.read_text(encoding="utf-8-sig"))
            props = feature["properties"]
            if not db.scalar(select(Route).where(Route.name == props["name"], Route.source == props["source"])):
                coordinates = feature["geometry"]["coordinates"]
                geometry = "SRID=4326;LINESTRING(" + ",".join(f"{x} {y}" for x, y in coordinates) + ")"
                db.add(Route(name=props["name"], geometry=geometry, distance_km=props["distance_km"],
                    duration_minutes=props["duration_minutes"], source=props["source"], public=True))
        for index, (name, level, distance, pace, interests, area) in enumerate([
            ("Ananya R.", "beginner", 20, "relaxed", ["nature", "photography"], "Mylapore"),
            ("Karthik S.", "beginner", 15, "relaxed", ["coast", "coffee"], "Adyar"),
            ("Meera K.", "intermediate", 30, "moderate", ["fitness", "nature"], "Teynampet"),
            ("Arjun P.", "advanced", 60, "fast", ["endurance", "exploration"], "Guindy"),
        ]):
            email = f"sample{index}@ridecircle.invalid"
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(email=email, password_hash=password_hash.hash(secrets.token_urlsafe(32)))
                db.add(user)
                db.flush()
                db.add(Profile(user_id=user.id, display_name=name, bio="Sample profile for exploring RideCircle. This is not a real cyclist.", area=area,
                    location=point(13.05 - index * .01, 80.25 + index * .01), experience=level, distance_km=distance, pace=pace,
                    interests=interests, days=["Saturday", "Sunday"], time="morning", discoverable=True, is_demo=True))
                event = Event(organizer_id=user.id, title=["Sunday coast & conversation", "A little ride, a lot of fresh air", "Morning miles together", "The longer Sunday"][index],
                    description="Sample event for testing RSVPs. This is not a real organized ride. Distance is a planning target; no route has been verified.",
                    start_area=area + " · sample meeting point", start_location=point(13.05, 80.25),
                    starts_at=(datetime.now(timezone.utc) + timedelta(days=2 + index)).replace(hour=1, minute=0, second=0, microsecond=0),
                    distance_km=distance, pace=pace, experience=level, max_participants=6 + index * 2, is_demo=True)
                db.add(event)
                db.flush()
                db.add(RSVP(event_id=event.id, user_id=user.id, status="attending"))
        db.commit()


if __name__ == "__main__":
    seed()
