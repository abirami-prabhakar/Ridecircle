import os
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://ridecircle:ridecircle-local-only@db:5432/ridecircle_test")
os.environ["AI_MODE"] = "rules"
os.environ["ROUTING_PROVIDER"] = "disabled"
import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.database import engine, Base
from app.main import app, limiter


@pytest.fixture(autouse=True)
def database():
    if engine.url.database != "ridecircle_test":
        raise RuntimeError("Tests may only run against the isolated ridecircle_test database")
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        Base.metadata.create_all(conn)
        conn.execute(text("TRUNCATE reports, blocks, rsvps, events, routes, spots, profiles, users RESTART IDENTITY CASCADE"))
    limiter.enabled = False
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def user_factory():
    def create(number=1, discoverable=False, lat=13.05, lon=80.25, **preferences):
        client = TestClient(app)
        response = client.post("/api/auth/register", json={"email": f"rider{number}@example.com", "password": "a-good-test-password", "display_name": f"Rider {number}"})
        assert response.status_code == 201, response.text
        uid = response.json()["id"]
        response = client.put("/api/profiles/me", json={"display_name": f"Rider {number}", "area": "Chennai", "lat": lat, "lon": lon,
            "discoverable": discoverable, "distance_km": 20, "interests": ["nature"], "days": ["Sunday"], **preferences})
        assert response.status_code == 200, response.text
        return client, uid
    return create
