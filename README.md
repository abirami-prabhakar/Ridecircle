# RideCircle

A local MVP for finding compatible cyclists, exploring real destinations, and organizing group rides. React + TypeScript, FastAPI, PostgreSQL/PostGIS, and optional local Gemma inference through Ollama.

## Start the app

Install Docker Desktop with its Linux engine enabled. From this directory:

```powershell
Copy-Item .env.example .env
# Replace JWT_SECRET with a random secret of at least 32 characters.
docker compose up -d --build
```

Open **http://localhost:5173**. Create your own account, set your preferences, then explore. API documentation: **http://localhost:8011/docs**. PostGIS is bound to localhost port **54329**. Services are local only. To stop them, run `docker compose down`; the database volume survives. Do not use `down -v` unless you intend to erase your local database.

The seed contains three sourced Chennai destinations, a real provider-calculated “Garden to coast” bicycle route, four explicitly fictional sample cyclists, and four sample events. Sample people and events are labeled and can be hidden. Sample accounts have random passwords and cannot be used for sign-in. The route geometry, 3.9452 km distance, and estimated duration were retrieved from FOSSGIS/OSRM's bicycle service on 9 October 2026. The route is not a safety or access guarantee.

## Map explorer

Discovery opens directly onto a real Leaflet map, with a floating editorial search panel and floating results. Select a route to highlight its actual path and inspect its source, distance, and duration. Place markers open sourced destination previews; cyclist avatars mark broad public neighborhood reference points, not stored personal coordinates. Unknown cyclist areas stay in the list instead of receiving invented map positions. Nearby avatars cluster when zoomed out.

Pan or zoom, then select **Search this area**. The backend combines the selected radius with validated viewport bounds using PostGIS, and applies privacy restrictions before returning records. Manual filters update the map automatically. Results from older requests cannot overwrite a newer search. On mobile, drag the results-sheet handle up or down, or tap it to expand/collapse.

Map styles use OpenStreetMap for standard mapping, OpenTopoMap for real terrain shading and contours, and an OpenStreetMap cycling view that emphasizes recorded route lines. The cycling view does not claim to be a complete cycling-infrastructure overlay. Terrain detail depends on the actual terrain and provider coverage. No elevation or difficulty is inferred; it appears only if supplied by a reliable route record.

The explorer components live in `frontend/src/features/explorer/`: `Explorer`, `AdventureMap`, `ResultPanel`, `SelectionPreview`, and the marker definitions. Authentication, profiles, and event actions continue to use the existing FastAPI backend. Open-source map/routing services require no paid API key in the default configuration.

## What works

- Registration, sign-in, logout, private-by-default profiles, profile editing, and account deletion.
- PostGIS radius filtering and approximate cyclist locations. Public cyclist responses omit coordinates and email.
- Cyclist matching with explanations; pace, level, distance, day, and time constraints stay in conventional code.
- Real destination cards, source links, an OpenStreetMap map, and recorded route geometry.
- Group ride creation, organizer status controls, interested/attending RSVPs, leave/rejoin, participant names, and capacity checks protected by PostgreSQL row locks.
- Block/unblock and report storage. Reports require local administrator review; there is no moderation dashboard or automated response.
- Keyword discovery without a model, and validated Gemma extraction when Ollama is enabled. AI returns only records retrieved from the database.

## Run Gemma locally — no training required

The MVP uses an existing instruction-tuned Gemma model. You do **not** need to train it. Install [Ollama](https://ollama.com/download), then run on your host:

```powershell
ollama pull gemma3:4b
ollama serve
```

If the Ollama desktop app already serves port 11434, skip `ollama serve`. Review the [Gemma model card and terms](https://ai.google.dev/gemma/docs/core/model_card_3). Select a smaller model if the default does not fit your RAM; actual latency and extraction quality depend on your hardware.

Set these in `.env`:

```dotenv
AI_MODE=ollama
OLLAMA_MODEL=gemma3:4b
```

Then run `docker compose up -d backend`. The container uses `host.docker.internal:11434` to reach host Ollama. It sends the `Intent` JSON schema to Ollama, validates the output with Pydantic, and retries malformed extraction once. If Ollama fails, the UI gives an error and offers ordinary filters. It never silently labels keyword extraction as AI.

The default `AI_MODE=rules` is a transparent keyword mode for local exploration before downloading a model. It recognizes explicit distances, experience, pace, days, times, interests, and record types. It does not interpret arbitrary language or resolve named locations. All searches use the selected area and radius. Model training and club discovery are outside this MVP.

### Evaluate before fine-tuning

```powershell
docker compose cp data/eval_prompts.json backend:/app/eval_prompts.json
docker compose exec -T backend python -m app.evaluate /app/eval_prompts.json
```

The hand-labeled examples measure valid output, field accuracy, exact matches, and median extraction latency. Run once in keyword mode and once in Ollama mode. Model output validity does not prove interpretation correctness: manually inspect failures and add examples. Ollama is for inference here. If real evaluation shows a need for fine-tuning, prepare a separate labeled training/held-out dataset and use a GPU environment such as Colab with a Gemma-compatible training framework; do not train on private cyclist data or use the evaluation examples as your training set.

## Destinations and routes

The seed points are representative destination locations, not verified entrances. Destination cards show direct geographic distance, **not ride distance**. Check access and cycling rules locally. Illustrated markers do not claim to depict the actual destination.

To calculate a cycling route, open a destination and select “Calculate cycling route.” The default `ROUTING_PROVIDER=osrm` uses the [FOSSGIS public OSRM bicycle service](https://routing.openstreetmap.de/about.html), with a global one-request-per-second limit in the local API process. Geometry, distance, and estimated duration come from the bicycle routing provider and are validated before being saved privately for your account. Your chosen start and destination coordinates are sent to the provider and may be logged there. Public infrastructure is for light local use; use a self-hosted or appropriately provisioned routing service before scaling. Provider routing does not verify current conditions or safety.

For optional [openrouteservice](https://openrouteservice.org/), set `ROUTING_PROVIDER=ors` and `ORS_API_KEY` in `.env`, then run `docker compose up -d backend`. Set `ROUTING_PROVIDER=disabled` to disable external route calculations. Imported and previously saved routes remain available.

You can also import a recorded route without a routing key:

```powershell
docker compose cp path/to/recorded-route.geojson backend:/app/recorded-route.geojson
docker compose exec -T backend python -m app.import_route /app/recorded-route.geojson --name "My recorded ride" --source "https://your-route-source-and-license"
```

The file must be a GeoJSON LineString or Feature in WGS84 `[longitude, latitude]` order. The CLI is a trusted administrator operation and publishes the imported route to signed-in users. PostGIS measures the geometry. Use route data you have permission to share; geometry alone does not establish bicycle access or safety.

Sources: [Marina Beach](https://en.wikipedia.org/wiki/Marina_Beach), [Semmozhi Poonga / Wikidata](https://www.wikidata.org/wiki/Q12068695), [Guindy National Park](https://en.wikipedia.org/wiki/Guindy_National_Park). Wikidata structured data is CC0; Wikipedia attribution is retained via source links. Summaries are original short descriptions. Standard map data is OpenStreetMap/ODbL; review the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before scaling. Terrain tiles include OpenStreetMap, SRTM, and OpenTopoMap attribution (CC-BY-SA). Route data includes FOSSGIS and OpenStreetMap attribution and an “Improve the map” link. The bundled source-backed route is in `backend/app/data/chennai-garden-coast.geojson`. Fonts come from Google Fonts, with local fallbacks. Maps and live routing require internet access; retrieved result lists remain usable when map tiles fail. The retained decorative photograph in `frontend/public` is credited in `credits.txt` and is no longer used on the discovery screen.

## Development

You can run just the database and backend in Docker, with Vite on the host:

```powershell
docker compose up -d --build db backend
cd frontend
npm ci
npm run dev
```

Alternatively, for Python development use Python 3.13+, create `backend/.venv`, install `requirements.txt`, then run `alembic upgrade head`, `python -m app.seed`, and `uvicorn app.main:app --reload --port 8011` from `backend`. Set `DATABASE_URL` if your database differs. Host Vite proxies `/api` to port 8011; the Docker frontend proxies to the backend service. Browser requests use the same origin and HTTP-only session cookies.

## Tests

Backend tests require an isolated PostGIS database named exactly `ridecircle_test`; the fixture refuses other database names. On first use:

```powershell
docker compose exec -T db psql -U ridecircle -d postgres -c "CREATE DATABASE ridecircle_test"
docker compose exec -T backend python -m pytest -q
```

With a custom database password, set `TEST_DATABASE_URL` in the test process. The default test URL is for local default credentials. Tests truncate **only the test database** and cover permissions, location filtering, duplicate RSVPs, concurrent capacity, account deletion, blocked visibility, input validation, model errors and retries, and provider-route privacy. Provider and model responses are mocked in deterministic tests; these tests do not establish real Gemma quality or provider availability.

Browser tests run against the seeded local backend:

```powershell
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

If the downloaded browser cannot launch on Windows, use your installed Chrome with `$env:PW_CHANNEL='chrome'` before running the browser tests.

They cover account creation, profile editing, natural-language discovery, source-backed destination details, route-unavailable feedback, event creation, leave/rejoin, logout/login, mobile overflow, and keyboard dialog access. Test accounts are deleted on successful completion. `.github/workflows/ci.yml` checks backend behavior against PostGIS and builds/types-checks the frontend when this folder becomes a repository.

## Boundaries

This is a local prototype. Production requires HTTPS with `COOKIE_SECURE=true`, a strong secret, origin configuration, a managed persistent database, appropriate tile/routing services, distributed rate limits if multiple API workers are used, operational logging and moderation, and account recovery. Current session lifetime is 12 hours and rate-limit counters are in memory. Profile areas are rounded to 0.01 degrees; individual coordinates are never returned to other cyclists. Event meeting points are intentionally public, so choose public landmarks.

Clubs, chat, live tracking, model training, report summaries, and multi-stop planning are deferred. No external account was connected, repository published, or cloud deployment performed.

See [architecture](docs/architecture.md) and [API notes](docs/api.md).

