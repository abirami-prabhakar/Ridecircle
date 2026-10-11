import json
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, or_, text, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from . import models as m, schemas as s
from .config import settings
from .database import get_db
from .auth import current_user, password_hash, DUMMY_HASH, set_session
from .discovery import point, coordinates, profile_json, blocked_ids, event_json, discover
from .ai import extract
from .routing import calculate

app = FastAPI(title="RideCircle", version="0.1.0")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def security_headers(request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin not in settings.allowed_origins:
            return JSONResponse({"detail": "Untrusted request origin"}, status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Cross-site request rejected"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "ai_mode": settings.ai_mode, "model": settings.ollama_model if settings.ai_mode == "ollama" else None}


@app.post("/api/auth/register", status_code=201)
@limiter.limit("10/minute")
def register(request: Request, data: s.Registration, response: Response, db: Session = Depends(get_db)):
    user = m.User(email=str(data.email).lower(), password_hash=password_hash.hash(data.password))
    db.add(user)
    try:
        db.flush()
        db.add(m.Profile(user_id=user.id, display_name=data.display_name, location=point(13.05, 80.25)))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    set_session(response, user.id)
    return {"id": user.id}


@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, data: s.Credentials, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(m.User).where(m.User.email == str(data.email).lower()))
    valid = password_hash.verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Email or password is incorrect")
    set_session(response, user.id)
    return {"id": user.id}


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("ridecircle_session")


@app.delete("/api/account", status_code=204)
def delete_account(response: Response, user=Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(m.Route).where(m.Route.owner_id == user.id))
    db.delete(user)
    db.commit()
    response.delete_cookie("ridecircle_session")


@app.get("/api/profiles/me")
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    return profile_json(db, db.get(m.Profile, user.id), own=True)


@app.put("/api/profiles/me")
def update_profile(data: s.ProfileInput, user=Depends(current_user), db: Session = Depends(get_db)):
    profile = db.get(m.Profile, user.id)
    for key, value in data.model_dump(exclude={"lat", "lon"}).items():
        setattr(profile, key, value)
    # Store only an approximate point, even for the owner. Public responses omit it.
    profile.location = point(round(data.lat, 2), round(data.lon, 2))
    db.commit()
    return profile_json(db, profile, own=True)


@app.get("/api/cyclists/{cyclist_id}")
def get_cyclist(cyclist_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    profile = db.get(m.Profile, cyclist_id)
    if not profile or (cyclist_id != user.id and (not profile.discoverable or cyclist_id in blocked_ids(db, user.id))):
        raise HTTPException(404, "Cyclist not found")
    return profile_json(db, profile, own=cyclist_id == user.id)


@app.get("/api/discover")
def search(lat: float = Query(13.05, ge=-90, le=90), lon: float = Query(80.25, ge=-180, le=180),
           radius_km: float = Query(25, gt=0, le=100), target: str = "all", distance_km: float | None = Query(None, gt=0, le=500),
           experience: s.Experience | None = None, pace: s.Pace | None = None, category: str | None = None,
           north: float | None = Query(None, ge=-90, le=90), south: float | None = Query(None, ge=-90, le=90),
           east: float | None = Query(None, ge=-180, le=180), west: float | None = Query(None, ge=-180, le=180),
           user=Depends(current_user), db: Session = Depends(get_db)):
    try:
        intent = s.Intent(target=target, distance_km=distance_km, experience=experience, pace=pace, category=category)
        bounds = None
        if any(v is not None for v in (north, south, east, west)):
            bounds = s.MapBounds(north=north, south=south, east=east, west=west)
    except ValueError:
        raise HTTPException(422, "Unsupported discovery filter")
    return {"intent": intent, "results": discover(db, user.id, lat, lon, radius_km, intent, bounds=bounds), "engine": "filters", "warnings": []}


@app.post("/api/ai/discover")
@limiter.limit("6/minute")
async def ai_discover(request: Request, data: s.DiscoveryRequest, user=Depends(current_user), db: Session = Depends(get_db)):
    intent, engine, warnings = await extract(data.query)
    # Named locations do not override the selected search area.
    return {"intent": intent, "engine": engine, "warnings": warnings,
            "results": discover(db, user.id, data.lat, data.lon, data.radius_km, intent, include_full=False, bounds=data.bounds)}


@app.get("/api/spots/{spot_id}")
def get_spot(spot_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    spot = db.get(m.Spot, spot_id)
    if not spot:
        raise HTTPException(404, "Destination not found")
    lat, lon = coordinates(db, spot.location)
    return {"id": spot.id, "name": spot.name, "category": spot.category, "description": spot.description,
            "lat": lat, "lon": lon, "tags": spot.tags, "source_url": spot.source_url, "source_note": spot.source_note}


@app.post("/api/routes/plan", status_code=201)
@limiter.limit("5/minute")
async def plan_route(request: Request, data: s.RoutePlan, user=Depends(current_user), db: Session = Depends(get_db)):
    if settings.routing_provider == "disabled":
        raise HTTPException(503, "Route calculation is unavailable. Enable the OSRM provider or configure openrouteservice.")
    spot = db.get(m.Spot, data.spot_id)
    if not spot:
        raise HTTPException(404, "Destination not found")
    lat, lon = coordinates(db, spot.location)
    computed = await calculate(data.lat, data.lon, lat, lon)
    geometry = computed.geometry.model_dump(mode="json")
    route = m.Route(owner_id=user.id, name=data.name, geometry=func.ST_GeogFromText("SRID=4326;" + db.scalar(select(func.ST_AsText(func.ST_GeomFromGeoJSON(json.dumps(geometry)))))),
                    distance_km=computed.distance_km, duration_minutes=computed.duration_minutes,
                    source=computed.source, public=False)
    db.add(route)
    db.commit()
    return {"id": route.id, "name": route.name, "geometry": geometry, "distance_km": route.distance_km,
            "duration_minutes": route.duration_minutes, "source": route.source}


@app.get("/api/events")
def list_events(user=Depends(current_user), db: Session = Depends(get_db)):
    excluded = blocked_ids(db, user.id)
    query = select(m.Event).where(m.Event.starts_at > datetime.now(timezone.utc))
    if excluded:
        query = query.where(m.Event.organizer_id.not_in(excluded))
    return [event_json(db, event, user.id) for event in db.scalars(query.order_by(m.Event.starts_at).limit(100))]


@app.post("/api/events", status_code=201)
def create_event(data: s.EventInput, user=Depends(current_user), db: Session = Depends(get_db)):
    if data.route_id:
        route = db.get(m.Route, data.route_id)
        if not route or not (route.public or route.owner_id == user.id):
            raise HTTPException(404, "Route not found")
    event = m.Event(organizer_id=user.id, start_location=point(data.lat, data.lon), **data.model_dump(exclude={"lat", "lon"}))
    db.add(event)
    db.flush()
    db.add(m.RSVP(event_id=event.id, user_id=user.id, status="attending"))
    db.commit()
    return event_json(db, event, user.id)


def accessible_event(db, event_id, uid, lock=False):
    query = select(m.Event).where(m.Event.id == event_id)
    if lock:
        query = query.with_for_update()
    event = db.scalar(query)
    if not event or event.organizer_id in blocked_ids(db, uid):
        raise HTTPException(404, "Ride not found")
    return event


@app.get("/api/events/{event_id}")
def get_event(event_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    event = accessible_event(db, event_id, user.id)
    item = event_json(db, event, user.id)
    excluded = blocked_ids(db, user.id)
    profiles = db.scalars(select(m.Profile).join(m.RSVP, m.RSVP.user_id == m.Profile.user_id).where(m.RSVP.event_id == event_id, m.RSVP.status == "attending", m.Profile.user_id.not_in(excluded or {-1})))
    # Only display names; attendance does not reveal a private profile or location.
    item["participants"] = [{"display_name": p.display_name} for p in profiles]
    return item


@app.patch("/api/events/{event_id}/status")
def event_status(event_id: int, status: str = Query(pattern="^(planned|confirmed|cancelled)$"), user=Depends(current_user), db: Session = Depends(get_db)):
    event = accessible_event(db, event_id, user.id, lock=True)
    if event.organizer_id != user.id:
        raise HTTPException(403, "Only the organizer can change this ride")
    if event.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(409, "This ride has already started")
    event.status = status
    db.commit()
    return event_json(db, event, user.id)


@app.post("/api/events/{event_id}/rsvps")
def rsvp(event_id: int, data: s.RSVPInput, user=Depends(current_user), db: Session = Depends(get_db)):
    event = accessible_event(db, event_id, user.id, lock=True)
    if event.status == "cancelled" or event.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(409, "This ride is no longer accepting RSVPs")
    existing = db.scalar(select(m.RSVP).where(m.RSVP.event_id == event_id, m.RSVP.user_id == user.id))
    if data.status == "attending" and (not existing or existing.status != "attending"):
        count = db.scalar(select(func.count(m.RSVP.id)).where(m.RSVP.event_id == event_id, m.RSVP.status == "attending"))
        if count >= event.max_participants:
            raise HTTPException(409, "This ride is full")
    if existing:
        existing.status = data.status
    else:
        db.add(m.RSVP(event_id=event_id, user_id=user.id, status=data.status))
    db.commit()
    return event_json(db, event, user.id)


@app.delete("/api/events/{event_id}/rsvps/me", status_code=204)
def leave(event_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    accessible_event(db, event_id, user.id, lock=True)
    existing = db.scalar(select(m.RSVP).where(m.RSVP.event_id == event_id, m.RSVP.user_id == user.id))
    if existing:
        db.delete(existing)
    db.commit()


@app.post("/api/blocks/{cyclist_id}", status_code=204)
def block(cyclist_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    if cyclist_id == user.id or not db.get(m.User, cyclist_id):
        raise HTTPException(422, "Choose another cyclist")
    if not db.scalar(select(m.Block).where(m.Block.user_id == user.id, m.Block.blocked_id == cyclist_id)):
        db.add(m.Block(user_id=user.id, blocked_id=cyclist_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


@app.get("/api/blocks")
def list_blocks(user=Depends(current_user), db: Session = Depends(get_db)):
    return [{"user_id": p.user_id, "display_name": p.display_name} for p in db.scalars(select(m.Profile).join(m.Block, m.Block.blocked_id == m.Profile.user_id).where(m.Block.user_id == user.id))]


@app.delete("/api/blocks/{cyclist_id}", status_code=204)
def unblock(cyclist_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    record = db.scalar(select(m.Block).where(m.Block.user_id == user.id, m.Block.blocked_id == cyclist_id))
    if record:
        db.delete(record)
        db.commit()


@app.post("/api/reports", status_code=201)
@limiter.limit("5/minute")
def report(request: Request, data: s.ReportInput, user=Depends(current_user), db: Session = Depends(get_db)):
    if data.target_type == "event":
        accessible_event(db, data.target_id, user.id)
    elif not db.get(m.Profile, data.target_id):
        raise HTTPException(404, "Cyclist not found")
    report = m.Report(author_id=user.id, **data.model_dump())
    db.add(report)
    db.commit()
    return {"id": report.id, "message": "Report saved for administrator review"}
