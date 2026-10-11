# Repository analysis — 11 October 2026

## Overview

RideCircle is a local cycling discovery MVP centered on Chennai. React 19, TypeScript, Vite, Leaflet and React Router form the frontend. FastAPI, SQLAlchemy, Alembic and PostgreSQL/PostGIS form the backend. Docker Compose connects the database, API and nginx frontend. Optional Ollama/Gemma extracts search intent; the default keyword mode works without a model. OSRM bicycle routing is the default external route provider; openrouteservice is optional.

The inspected workspace has no `.git` directory. It is a project snapshot rather than an initialized Git checkout, so tracked/untracked status and historical changes could not be verified.

## Structure and data flow

- `frontend/src/App.tsx`: authentication, profiles, ride dialogs and shared application state.
- `frontend/src/features/explorer/`: map, search, result panels, previews and markers.
- `frontend/src/api.ts`: same-origin requests using HTTP-only session cookies.
- `backend/app/main.py`: API endpoints, origin checks and request rate limits.
- `backend/app/discovery.py`: geographic filtering, cyclist scoring and result serialization.
- `backend/app/models.py` and `schemas.py`: persistent records and validated API inputs.
- `backend/app/ai.py` and `routing.py`: validated model intent and external route calculations.
- `backend/migrations/`, `backend/tests/`, `frontend/tests/`: schema setup and existing automated checks.
- `data/`, `backend/app/data/`, `docs/`: evaluation prompts, source-backed route geometry and documentation.

Search intent is validated and translated into database queries. PostGIS filters by radius and optional viewport. The model does not generate the returned people, places or routes. RSVP writes lock the event row before checking capacity.

## Strengths

Profiles are private by default; other cyclists' responses omit email and coordinates. Stored profile coordinates are rounded. Blocking applies in both directions. Inputs forbid unexpected fields and validate coordinate ranges, future event times and route geometry. Authentication uses Argon2 password hashing and expiring signed cookies. The frontend guards against stale search responses and includes modal keyboard handling. Existing tests cover permissions, concurrency, geography, provider failures and mobile interactions. Docker ports bind to localhost and database storage is a persistent named volume.

## Findings, in priority order

1. **Deployment settings do not reach the backend container.** `backend/app/config.py` supports `COOKIE_SECURE` and `ALLOWED_ORIGINS`, but `docker-compose.yml` does not forward them. The backend Docker build context excludes the root `.env`. Adding these settings only to the root `.env` therefore does not change container behavior: cookies remain configured without Secure, and a new production origin is rejected on writes. Explicit Compose forwarding or equivalent deployment configuration is required before hosting publicly.

2. **A known JWT secret is accepted by default.** Both backend settings and Compose include the same development fallback; startup does not validate secret strength. The README asks users to replace it. This is acceptable only as a deliberate local setup; a public deployment needs enforced configuration rather than relying on the README.

3. **Logout clears the browser cookie but does not revoke an issued token.** `main.py` deletes the cookie; `auth.py` verifies the signature, expiry and user existence without session revocation state. A copied token remains accepted until its 12-hour expiry unless the user account is deleted or the signing key changes. Decide whether this session behavior meets deployment requirements.

4. **Cyclist ranking only considers the first 100 matching user IDs.** `discovery.py` loads candidates ordered by ID, scores them in Python and returns the top 30. With more than 100 matching cyclists, a better match outside that first batch cannot appear. Event filtering similarly applies day/time/date checks after a 100-record database limit and can omit later matching rides.

5. **Discovery performs repeated database queries.** Each event serialization queries attendance, the current user's RSVP and the organizer separately; route serialization queries GeoJSON for each route. Event lists can serialize 100 records. Query batching would reduce request cost as data grows. Async AI and route handlers also perform synchronous database work on the event-loop thread; this deserves load testing before adding concurrency.

6. **The frontend ships a large initial JavaScript chunk.** The fresh build produced a 695.17 kB minified JavaScript file (212.59 kB gzip), and Vite emitted its chunk-size warning. Map and route-specific loading boundaries are candidates for reducing initial download size. This is a build-size observation, not a measured page-speed failure.

7. **Backend dependency resolution and migrations need stronger reproducibility.** Python requirements use version ranges without a resolved lockfile; frontend dependencies have a retained npm lockfile. The initial Alembic revision imports current application models and calls `Base.metadata.create_all`, so changing models later can change what the historical migration creates. Future schema evolution should use explicit migrations.

8. **CI assumes `ridecircle` becomes the repository root.** `.github/workflows/ci.yml` uses `backend` and `frontend` paths. Publishing the whole parent workspace would leave the workflow nested and its paths incorrect. CI builds the frontend and runs backend tests, but does not run the Playwright suite.

Reports currently have storage but no moderation interface; account recovery, distributed rate limits and operational monitoring remain documented production gaps. Real Gemma quality was not assessed in this review.

## Cleanup

Removed the workspace npm cache, downloaded Playwright browsers/tools, temporary caches, frontend `node_modules`, build output, generated test results, TypeScript build metadata and the backend virtual environment. The previously inaccessible temporary folder was removed with elevated access. Measured removal was at least **1,058.35 MiB (1.03 GiB)**; the initial scan could not measure the protected temporary folder.

Preserved source code, npm lockfile, requirements, `.env`, sample data, documentation screenshots, photo/attribution assets and `RideCircle_Idea_Report.docx`. The photograph still has a CSS reference, so it was not treated as disposable. Docker volumes and application data were not touched. Added `*.tsbuildinfo` to `.gitignore` so generated TypeScript metadata stays out of future commits.

The itemized deletion record is `cleanup-log.json`. Dependencies and browser tools must be reinstalled before local development/testing: run `npm ci` in `frontend`; install Python requirements into a recreated virtual environment for host backend development; install Playwright Chromium if running browser tests. Docker builds install their own dependencies.

## Verification and limits

- Fresh `npm run build`: passed TypeScript compilation and Vite production bundling before dependencies/output were removed.
- Python AST parsing: passed for all 21 backend Python source, migration, script and test files.
- Docker engine: unavailable. Backend PostGIS tests and browser tests were not rerun. Existing `docs/validation.md` records earlier results, which are historical evidence rather than fresh validation.
- Cleanup targets were resolved and checked to stay inside this workspace before recursive deletion; removal was checked afterward.
- Community Wisdom lookup was attempted through DevRelay, but returned an MLH sign-in requirement. No community sources or consensus were fabricated. Findings above come from inspected project code and the fresh build.

No application behavior was changed during this cleanup and review.
