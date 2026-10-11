import pytest
from app.database import SessionLocal
from app.models import Spot, Route
from app.discovery import point


def test_map_bounds_restrict_manual_and_ai_results(user_factory):
    client, uid = user_factory(1)
    other, other_id = user_factory(2, True)
    with SessionLocal() as db:
        db.add_all([
            Spot(name="Inside test viewport",category="park",location=point(13.05,80.25),description="Fixture",tags=["nature"],source_url="https://example.com",source_note="Fixture"),
            Spot(name="Outside viewport but within radius",category="park",location=point(13.09,80.29),description="Fixture",tags=["nature"],source_url="https://example.com",source_note="Fixture"),
        ])
        db.add(Route(name="Intersecting recorded fixture",geometry="SRID=4326;LINESTRING(80.24 13.05,80.26 13.05)",distance_km=2,source="Test geometry",public=True))
        db.commit()
    response=client.get("/api/discover?lat=13.05&lon=80.25&radius_km=25&north=13.06&south=13.04&east=80.26&west=80.24")
    assert response.status_code==200,response.text
    data=response.json()["results"]
    assert [s["name"] for s in data["spots"]]==["Inside test viewport"]
    assert len(data["cyclists"])==1 and len(data["routes"])==1
    response=client.post("/api/ai/discover",json={"query":"Show parks with greenery","lat":13.05,"lon":80.25,"radius_km":25,
                        "bounds":{"north":13.06,"south":13.04,"east":80.26,"west":80.24}})
    assert response.status_code==200,response.text
    assert [s["name"] for s in response.json()["results"]["spots"]]==["Inside test viewport"]


@pytest.mark.parametrize("query",["north=13.06","north=13.04&south=13.06&east=80.26&west=80.24","north=100&south=0&east=10&west=0"])
def test_map_bounds_reject_invalid_extents(user_factory,query):
    client,_=user_factory()
    assert client.get("/api/discover?"+query).status_code==422
