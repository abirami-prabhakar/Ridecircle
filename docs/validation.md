# Local validation

Validated on 9 October 2026 using Docker Desktop, PostgreSQL 17 / PostGIS 3.5, Node 24 on Windows, and the backend's Python 3.13 container.

- `npm run build`: TypeScript and Vite production build pass.
- `python -m pytest -q`: 27 backend cases pass against an isolated real PostGIS database, including concurrent requests for the final event place, viewport filtering, malformed bounds, OSRM geometry validation, and private-route deletion.
- `npm run test:e2e`: two map-explorer scenarios pass using installed Chrome. They include onboarding, route highlighting, source-backed destination previews, profile compatibility, sample visibility, filters and empty results, map styles, viewport search, RSVP actions, a 390px draggable mobile sheet, marker selection, and modal keyboard access. The downloaded Chromium executable could not launch in this environment; `PW_CHANNEL=chrome` used the installed browser instead.
- `python -m app.evaluate /app/eval_prompts.json`: keyword extraction matches all 10 labeled expectations (nine valid extractions, one expected unsupported-club error). This small sample is not a general quality benchmark.
- All three Compose services run locally: frontend 5173, API 8011, PostGIS 54329.

Live OSRM bicycle routing was verified through the app with a temporary local account that was deleted afterward: 3.9452 km, 121 geometry points, matching the source-backed Chennai seed route. The model integration and optional openrouteservice provider are mocked in deterministic tests. Real Gemma inference remains unverified because Ollama is not installed. `AI_MODE=rules` is active; the configured model is `gemma3:4b` for later local inference.

DevRelay Community Wisdom and challenge discovery were attempted, but the gateway required an MLH connection. No account login was initiated and no community claims were fabricated. Automatic approval review rejected the unrelated read of private MLH event registrations. Implementation references were the official [FastAPI authentication guide](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [PostGIS ST_DWithin documentation](https://postgis.net/docs/ST_DWithin.html), and [Ollama structured-output documentation](https://docs.ollama.com/capabilities/structured-outputs).
