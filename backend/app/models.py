from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geography
from .database import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(60))
    bio: Mapped[str] = mapped_column(Text, default="")
    area: Mapped[str] = mapped_column(String(100), default="Chennai")
    location = mapped_column(Geography("POINT", srid=4326))
    experience: Mapped[str] = mapped_column(String(20), default="beginner")
    distance_km: Mapped[float] = mapped_column(Float, default=20)
    pace: Mapped[str] = mapped_column(String(20), default="relaxed")
    interests: Mapped[list] = mapped_column(JSONB, default=list)
    days: Mapped[list] = mapped_column(JSONB, default=list)
    time: Mapped[str] = mapped_column(String(20), default="morning")
    ride_type: Mapped[str] = mapped_column(String(20), default="casual")
    group_size: Mapped[int] = mapped_column(Integer, default=6)
    discoverable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class Spot(Base):
    __tablename__ = "spots"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    category: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(Text)
    location = mapped_column(Geography("POINT", srid=4326))
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    source_url: Mapped[str] = mapped_column(Text)
    source_note: Mapped[str] = mapped_column(Text)


class Route(Base):
    __tablename__ = "routes"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(120))
    geometry = mapped_column(Geography("LINESTRING", srid=4326))
    distance_km: Mapped[float] = mapped_column(Float)
    duration_minutes: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(Text)
    public: Mapped[bool] = mapped_column(Boolean, default=False)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (CheckConstraint("max_participants > 0"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    start_area: Mapped[str] = mapped_column(String(120))
    start_location = mapped_column(Geography("POINT", srid=4326))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    distance_km: Mapped[float] = mapped_column(Float)
    pace: Mapped[str] = mapped_column(String(20))
    experience: Mapped[str] = mapped_column(String(20))
    max_participants: Mapped[int] = mapped_column(Integer)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), default="planned")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)


class RSVP(Base):
    __tablename__ = "rsvps"
    __table_args__ = (UniqueConstraint("event_id", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20))


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (UniqueConstraint("user_id", "blocked_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    blocked_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
