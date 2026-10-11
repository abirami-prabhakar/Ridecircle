"""Bicycle routing from real providers; public OSRM is limited to one request/sec."""
import asyncio
from datetime import datetime, timezone
from time import monotonic
import httpx
from fastapi import HTTPException
from pydantic import ValidationError
from .config import settings
from .schemas import ComputedRoute

_public_lock = asyncio.Lock()
_last_public_request = 0.0


async def calculate(start_lat, start_lon, end_lat, end_lon):
    global _last_public_request
    provider = settings.routing_provider
    if provider == "disabled":
        raise HTTPException(503, "Route calculation is unavailable. Enable OSRM or configure openrouteservice.")
    if provider == "ors" and not settings.ors_api_key:
        raise HTTPException(503, "Route calculation is unavailable. Configure ORS_API_KEY, or select the OSRM provider.")
    try:
        async with httpx.AsyncClient(timeout=25, headers={"User-Agent": "RideCircle-Local-MVP/0.1 (cycling discovery)"}) as client:
            if provider == "ors":
                response = await client.post("https://api.openrouteservice.org/v2/directions/cycling-regular/geojson",
                    headers={"Authorization":settings.ors_api_key},json={"coordinates":[[start_lon,start_lat],[end_lon,end_lat]]})
                response.raise_for_status()
                feature = response.json()["features"][0]
                geometry, distance, duration = feature["geometry"], feature["properties"]["summary"]["distance"], feature["properties"]["summary"]["duration"]
                source = "openrouteservice / cycling-regular"
            else:
                # The routed-bike service uses a bicycle graph. Its API profile path is 'driving'.
                async with _public_lock:
                    pause = 1 - (monotonic() - _last_public_request)
                    if pause > 0:
                        await asyncio.sleep(pause)
                    _last_public_request = monotonic()
                    response = await client.get(f"https://routing.openstreetmap.de/routed-bike/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}",
                                                params={"overview":"full","geometries":"geojson"})
                    response.raise_for_status()
                body = response.json()
                if body.get("code") != "Ok":
                    raise ValueError("No bicycle route")
                route = body["routes"][0]
                geometry, distance, duration = route["geometry"], route["distance"], route["duration"]
                source = "FOSSGIS OSRM bicycle routing / OpenStreetMap"
            return ComputedRoute(geometry=geometry,distance_km=distance/1000,duration_minutes=duration/60,
                                 source=source+" / "+datetime.now(timezone.utc).isoformat())
    except (httpx.HTTPError, ValidationError, KeyError, ValueError, IndexError, TypeError):
        raise HTTPException(502,"The bicycle routing service could not calculate this ride. Try a different starting point or destination.")
