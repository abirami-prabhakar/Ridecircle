# API

Interactive request/response schemas are available at `http://localhost:8011/docs`. All discovery and resource APIs require the session cookie; authentication and health are public.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a private profile and sign in |
| POST | `/api/auth/login` | Verify password and set session cookie |
| POST | `/api/auth/logout` | Clear cookie |
| DELETE | `/api/account` | Delete the signed-in account and dependent data |
| GET / PUT | `/api/profiles/me` | Read/update only your profile |
| GET | `/api/cyclists/{id}` | Public discoverable profile, or your own |
| GET | `/api/discover` | Manual, geographic discovery across record types |
| POST | `/api/ai/discover` | Validate intent then return real records |
| GET | `/api/spots/{id}` | Source-backed destination details |
| POST | `/api/routes/plan` | Calculate and privately save a provider route |
| GET / POST | `/api/events` | List upcoming events / create a ride |
| GET | `/api/events/{id}` | Details and participant display names |
| PATCH | `/api/events/{id}/status?status=confirmed` | Organizer only: planned/confirmed/cancelled |
| POST | `/api/events/{id}/rsvps` | Upsert interested/attending |
| DELETE | `/api/events/{id}/rsvps/me` | Leave the ride |
| GET | `/api/blocks` | Your blocked cyclists |
| POST / DELETE | `/api/blocks/{id}` | Block/unblock another cyclist |
| POST | `/api/reports` | Store a report for administrator review |
| GET | `/api/health` | Database availability and configured inference mode |

Manual query example: `/api/discover?lat=13.05&lon=80.25&radius_km=25&experience=beginner&pace=relaxed`. Optional `target` is all/cyclists/spots/events/routes. Distance is a desired ride length; candidate distances must be within 30%. Categorical restrictions are hard constraints. Coordinate and radius limits are enforced server-side.

Optional `north`, `south`, `east`, and `west` must be supplied together and define the selected map viewport. North must exceed south and east must exceed west. This local implementation does not support a viewport spanning the antimeridian. PostGIS applies the viewport in addition to the selected radius. The AI endpoint accepts the same four fields in an optional `bounds` object; a model cannot override these geographic constraints.

`POST /api/routes/plan` uses the bicycle-specific OSRM service by default. `ROUTING_PROVIDER=ors` selects openrouteservice, and `disabled` returns 503. Computed geometry must be a valid LineString with bounded, finite coordinates and positive distance/duration. The provider adapter is `app/routing.py`; model inference is separate in `app/ai.py`.

AI request:

```json
{"query":"Find beginner cyclists for a relaxed 20 km Sunday ride","lat":13.05,"lon":80.25,"radius_km":25}
```

Response contains `engine` (keyword/gemma), `intent`, `warnings`, and `results` with cyclists/spots/events/routes arrays. Empty arrays are valid and do not get filled with generated records. Unknown request properties are rejected. Responses never include private cyclist coordinates or email. The selected geographic area remains authoritative even if text mentions another city; use the area control to change it.

Dates require a timezone and must be in the future. UI event times and availability filters use Asia/Kolkata. Event distances without a linked route are planning targets. Error status codes: 401 sign-in required; 403 forbidden action/origin; 404 unavailable/private resource; 409 conflict/full ride; 422 invalid input; 429 rate limit; 502 invalid model/provider response; 503 model/routing service unavailable.
