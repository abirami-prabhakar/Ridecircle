import httpx
import pytest
from app.config import settings
from app.database import SessionLocal
from app.models import Spot
from app.discovery import point
import app.routing as routing


@pytest.mark.parametrize("invalid", [False, True])
def test_bicycle_osrm_geometry_and_validation(user_factory, monkeypatch, invalid):
    client,_=user_factory()
    with SessionLocal() as db:
        spot=Spot(name="Routing fixture",category="park",location=point(13.06,80.27),description="Fixture",tags=[],source_url="https://example.com",source_note="Fixture")
        db.add(spot);db.commit();spot_id=spot.id
    geometry={"type":"LineString","coordinates":[[80.25,13.05],[80.26,13.052],[80.27,13.06]]}
    class Provider:
        def __init__(self,**kwargs):
            assert "RideCircle" in kwargs["headers"]["User-Agent"]
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def get(self,url,**kwargs):
            assert "routed-bike" in url and "80.25,13.05;80.27,13.06" in url
            assert kwargs["params"]["geometries"]=="geojson"
            return httpx.Response(200,request=httpx.Request("GET",url),json={"code":"Ok","routes":[{"geometry":geometry,"distance":-1 if invalid else 2600,"duration":650}]})
    monkeypatch.setattr(settings,"routing_provider","osrm")
    monkeypatch.setattr(httpx,"AsyncClient",Provider)
    monkeypatch.setattr(routing,"_last_public_request",0)
    response=client.post("/api/routes/plan",json={"spot_id":spot_id,"lat":13.05,"lon":80.25,"name":"Recorded provider route"})
    assert response.status_code==(502 if invalid else 201),response.text
    if not invalid:
        assert response.json()["geometry"]==geometry
        assert response.json()["distance_km"]==2.6
        assert "FOSSGIS OSRM bicycle" in response.json()["source"]
