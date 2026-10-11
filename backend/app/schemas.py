from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Experience = Literal["beginner", "intermediate", "advanced"]
Pace = Literal["relaxed", "moderate", "fast"]
Day = Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
Interest = Literal["nature", "fitness", "photography", "exploration", "endurance", "coffee", "coast"]
Time = Literal["morning", "afternoon", "evening"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Credentials(Strict):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class Registration(Credentials):
    display_name: str = Field(min_length=2, max_length=60)


class Position(Strict):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ProfileInput(Position):
    display_name: str = Field(min_length=2, max_length=60)
    bio: str = Field(default="", max_length=1000)
    area: str = Field(min_length=2, max_length=100)
    experience: Experience = "beginner"
    distance_km: float = Field(default=20, gt=0, le=500)
    pace: Pace = "relaxed"
    interests: list[Interest] = Field(default_factory=list, max_length=7)
    days: list[Day] = Field(default_factory=list, max_length=7)
    time: Time = "morning"
    ride_type: Literal["casual", "fitness", "adventure", "commuting"] = "casual"
    group_size: int = Field(default=6, ge=2, le=50)
    discoverable: bool = False


class Intent(Strict):
    target: Literal["all", "cyclists", "spots", "events", "routes"] = "all"
    distance_km: float | None = Field(default=None, gt=0, le=500)
    experience: Experience | None = None
    pace: Pace | None = None
    days: list[Day] = Field(default_factory=list, max_length=7)
    time: Time | None = None
    interests: list[Interest] = Field(default_factory=list, max_length=7)
    category: Literal["beach", "park", "lake", "cafe", "viewpoint", "historic"] | None = None
    date: datetime | None = None


class MapBounds(Strict):
    north: float = Field(ge=-90, le=90)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    west: float = Field(ge=-180, le=180)

    @model_validator(mode="after")
    def valid_extent(self):
        if self.north <= self.south or self.east <= self.west:
            raise ValueError("Map bounds must have north > south and east > west")
        return self


class DiscoveryRequest(Position):
    query: str = Field(min_length=3, max_length=1000)
    radius_km: float = Field(default=25, gt=0, le=100)
    bounds: MapBounds | None = None


class EventInput(Position):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)
    start_area: str = Field(min_length=3, max_length=120)
    starts_at: datetime
    distance_km: float = Field(gt=0, le=500)
    pace: Pace
    experience: Experience
    max_participants: int = Field(ge=2, le=100)
    route_id: int | None = None

    @field_validator("starts_at")
    @classmethod
    def future_date(cls, value):
        if value.tzinfo is None or value <= datetime.now(timezone.utc):
            raise ValueError("Provide a future date and time with a timezone")
        return value


class RSVPInput(Strict):
    status: Literal["interested", "attending"]


class RoutePlan(Position):
    spot_id: int
    name: str = Field(min_length=3, max_length=120)


class RouteGeometry(Strict):
    type: Literal["LineString"]
    coordinates: list[tuple[float, float]] = Field(min_length=2, max_length=50000)

    @field_validator("coordinates")
    @classmethod
    def valid_coordinates(cls, coordinates):
        if any(not -180 <= x <= 180 or not -90 <= y <= 90 for x, y in coordinates):
            raise ValueError("Route coordinates must be valid longitude/latitude pairs")
        return coordinates


class ComputedRoute(Strict):
    geometry: RouteGeometry
    distance_km: float = Field(gt=0, le=500)
    duration_minutes: float = Field(gt=0, le=10000)
    source: str


class ReportInput(Strict):
    target_type: Literal["cyclist", "event"]
    target_id: int
    reason: str = Field(min_length=10, max_length=1000)
