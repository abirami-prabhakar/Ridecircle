import json
from datetime import datetime, timezone
from sqlalchemy import select, func, or_, cast, ARRAY, Text
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session
from .models import Profile, Spot, Route, Event, RSVP, Block
from .schemas import Intent


def point(lat, lon):
    return f"SRID=4326;POINT({lon} {lat})"


def coordinates(db, value):
    shape = to_shape(WKTElement(value, extended=True) if isinstance(value, str) else value)
    return shape.y, shape.x


def profile_json(db, p, own=False):
    data = {"user_id": p.user_id, "display_name": p.display_name, "bio": p.bio, "area": p.area,
            "experience": p.experience, "distance_km": p.distance_km, "pace": p.pace,
            "interests": p.interests, "days": p.days, "time": p.time, "ride_type": p.ride_type,
            "group_size": p.group_size, "is_demo": p.is_demo}
    if own:
        lat, lon = coordinates(db, p.location)
        data.update(lat=lat, lon=lon, discoverable=p.discoverable)
    return data


def blocked_ids(db, uid):
    pairs = db.execute(select(Block.user_id, Block.blocked_id).where(or_(Block.user_id == uid, Block.blocked_id == uid))).all()
    return {b if a == uid else a for a, b in pairs}


def rank_profile(p, intent):
    # Unspecified dimensions do not silently penalize a candidate.
    signals, reasons = [], []
    if intent.distance_km is not None:
        similarity = max(0, 1 - abs(p.distance_km - intent.distance_km) / max(p.distance_km, intent.distance_km))
        signals.append((.30, similarity))
        if similarity >= .7:
            reasons.append("Similar preferred ride distance")
    if intent.pace:
        signals.append((.25, float(p.pace == intent.pace)))
        if p.pace == intent.pace:
            reasons.append("Compatible riding pace")
    if intent.interests:
        common = set(p.interests) & set(intent.interests)
        signals.append((.20, len(common) / len(set(intent.interests))))
        if common:
            reasons.append("Shared interests: " + ", ".join(sorted(common)))
    if intent.days or intent.time:
        matches = bool(set(p.days) & set(intent.days)) if intent.days else True
        matches = matches and (p.time == intent.time if intent.time else True)
        signals.append((.15, float(matches)))
        if matches:
            reasons.append("Overlapping ride availability")
    if intent.experience:
        signals.append((.10, float(p.experience == intent.experience)))
        if p.experience == intent.experience:
            reasons.append("Same experience level")
    score = round(sum(w * s for w, s in signals) / sum(w for w, _ in signals) * 100) if signals else None
    return score, reasons or ["Within your selected discovery area"]


def bounded(query, column, bounds):
    if bounds is None:
        return query
    envelope = func.ST_MakeEnvelope(bounds.west, bounds.south, bounds.east, bounds.north, 4326)
    return query.where(func.ST_Intersects(cast(column, Geometry), envelope))


def cyclists(db, uid, lat, lon, radius, intent, bounds=None):
    query = select(Profile).where(Profile.discoverable.is_(True), Profile.user_id != uid,
        func.ST_DWithin(Profile.location, func.ST_GeogFromText(point(lat, lon)), radius * 1000))
    excluded = blocked_ids(db, uid)
    query = bounded(query, Profile.location, bounds)
    if excluded:
        query = query.where(Profile.user_id.not_in(excluded))
    if intent.experience:
        query = query.where(Profile.experience == intent.experience)
    if intent.pace:
        query = query.where(Profile.pace == intent.pace)
    if intent.distance_km:
        query = query.where(Profile.distance_km.between(intent.distance_km * .7, intent.distance_km * 1.3))
    if intent.days:
        query = query.where(Profile.days.op("?|")(cast(intent.days, ARRAY(Text))))
    if intent.time:
        query = query.where(Profile.time == intent.time)
    result = []
    for p in db.scalars(query.order_by(Profile.user_id).limit(100)):
        score, reasons = rank_profile(p, intent)
        result.append({**profile_json(db, p), "score": score, "reasons": reasons})
    return sorted(result, key=lambda r: -(r["score"] or 0))[:30]


def spots(db, lat, lon, radius, intent, bounds=None):
    origin = func.ST_GeogFromText(point(lat, lon))
    query = select(Spot, func.ST_Distance(Spot.location, origin).label("distance")).where(func.ST_DWithin(Spot.location, origin, radius * 1000))
    query = bounded(query, Spot.location, bounds)
    if intent.category:
        query = query.where(Spot.category == intent.category)
    if intent.interests:
        query = query.where(Spot.tags.op("?|")(cast(intent.interests, ARRAY(Text))))
    result = []
    for s, distance in db.execute(query.order_by("distance").limit(50)):
        lat_s, lon_s = coordinates(db, s.location)
        result.append({"id": s.id, "name": s.name, "category": s.category, "description": s.description,
                       "lat": lat_s, "lon": lon_s, "distance_km": round(distance / 1000, 1),
                       "tags": s.tags, "source_url": s.source_url, "source_note": s.source_note,
                       "reasons": ["Within your selected area"] + (["Matches " + ", ".join(set(s.tags) & set(intent.interests))] if intent.interests else [])})
    return result


def event_json(db, event, uid):
    attending = db.scalar(select(func.count(RSVP.id)).where(RSVP.event_id == event.id, RSVP.status == "attending"))
    rsvp = db.scalar(select(RSVP.status).where(RSVP.event_id == event.id, RSVP.user_id == uid))
    organizer = db.get(Profile, event.organizer_id)
    lat, lon = coordinates(db, event.start_location)
    return {"id": event.id, "title": event.title, "description": event.description, "start_area": event.start_area,
            "lat": lat, "lon": lon, "starts_at": event.starts_at, "distance_km": event.distance_km,
            "pace": event.pace, "experience": event.experience, "max_participants": event.max_participants,
            "attending": attending, "my_rsvp": rsvp, "organizer": organizer.display_name if organizer else "Cyclist",
            "organizer_id": event.organizer_id, "status": event.status, "is_full": attending >= event.max_participants,
            "is_demo": event.is_demo, "route_id": event.route_id}


def events(db, uid, lat, lon, radius, intent, include_full=True, bounds=None):
    query = select(Event).where(Event.starts_at > datetime.now(timezone.utc), Event.status != "cancelled",
                              func.ST_DWithin(Event.start_location, func.ST_GeogFromText(point(lat, lon)), radius * 1000))
    excluded = blocked_ids(db, uid)
    query = bounded(query, Event.start_location, bounds)
    if excluded:
        query = query.where(Event.organizer_id.not_in(excluded))
    if intent.distance_km:
        query = query.where(Event.distance_km.between(intent.distance_km * .7, intent.distance_km * 1.3))
    if intent.pace:
        query = query.where(Event.pace == intent.pace)
    if intent.experience:
        query = query.where(Event.experience == intent.experience)
    result = []
    for event in db.scalars(query.order_by(Event.starts_at).limit(100)):
        local = event.starts_at.astimezone(__import__('zoneinfo').ZoneInfo("Asia/Kolkata"))
        if intent.days and local.strftime("%A") not in intent.days:
            continue
        if intent.time and ("morning" if local.hour < 12 else "afternoon" if local.hour < 17 else "evening") != intent.time:
            continue
        if intent.date and local.date() != intent.date.date():
            continue
        item = event_json(db, event, uid)
        if include_full or not item["is_full"]:
            result.append({**item, "reasons": ["Upcoming ride within your area", "Full" if item["is_full"] else "Places available"]})
    return result[:30]


def routes(db, uid, lat, lon, radius, intent, bounds=None):
    query = select(Route).where(or_(Route.public.is_(True), Route.owner_id == uid), func.ST_DWithin(Route.geometry, func.ST_GeogFromText(point(lat, lon)), radius * 1000))
    query = bounded(query, Route.geometry, bounds)
    if intent.distance_km:
        query = query.where(Route.distance_km.between(intent.distance_km * .7, intent.distance_km * 1.3))
    return [{"id": r.id, "name": r.name, "distance_km": r.distance_km, "duration_minutes": r.duration_minutes,
             "source": r.source, "geometry": json.loads(db.scalar(select(func.ST_AsGeoJSON(r.geometry)))),
             "reasons": ["Recorded route in your search area"]} for r in db.scalars(query.order_by(Route.id).limit(30))]


def discover(db: Session, uid, lat, lon, radius, intent: Intent, include_full=True, bounds=None):
    result = {"cyclists": [], "spots": [], "events": [], "routes": []}
    handlers = {"cyclists": lambda: cyclists(db, uid, lat, lon, radius, intent, bounds), "spots": lambda: spots(db, lat, lon, radius, intent, bounds),
                "events": lambda: events(db, uid, lat, lon, radius, intent, include_full, bounds), "routes": lambda: routes(db, uid, lat, lon, radius, intent, bounds)}
    for target, handler in handlers.items():
        if intent.target in ("all", target):
            result[target] = handler()
    return result
