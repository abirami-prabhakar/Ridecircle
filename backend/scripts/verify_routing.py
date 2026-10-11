"""Optional live routing smoke check; creates then deletes its own test account."""
import uuid
import httpx

with httpx.Client(base_url="http://localhost:8000",timeout=35) as client:
    account=client.post("/api/auth/register",json={"email":f"routing-smoke-{uuid.uuid4().hex}@example.com","password":uuid.uuid4().hex,"display_name":"Routing smoke check"})
    account.raise_for_status()
    try:
        spots=client.get("/api/discover").json()["results"]["spots"]
        beach=next(s for s in spots if s["name"]=="Marina Beach")
        response=client.post("/api/routes/plan",json={"lat":13.05238,"lon":80.25104,"spot_id":beach["id"],"name":"Live bicycle routing verification"})
        response.raise_for_status()
        route=response.json()
        assert route["geometry"]["type"]=="LineString" and len(route["geometry"]["coordinates"])>2
        print({"status":"live bicycle routing passed","distance_km":route["distance_km"],"points":len(route["geometry"]["coordinates"]),"source":route["source"]})
    finally:
        deletion=client.delete("/api/account")
        deletion.raise_for_status()
