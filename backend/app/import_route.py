"""Import a recorded LineString; measured length comes from PostGIS, not AI."""
import argparse
import json
from pathlib import Path
from sqlalchemy import select, func
from .database import SessionLocal
from .models import Route


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--name", required=True)
    parser.add_argument("--source", required=True, help="Source attribution / license URL")
    args = parser.parse_args()
    content = json.loads(args.file.read_text(encoding="utf-8"))
    geom = content.get("geometry", content)
    if geom.get("type") != "LineString" or len(geom.get("coordinates", [])) < 2:
        parser.error("Provide a GeoJSON LineString or Feature with at least two points")
    for coordinate in geom["coordinates"]:
        if len(coordinate) != 2 or not all(isinstance(v, (int, float)) for v in coordinate) or not -180 <= coordinate[0] <= 180 or not -90 <= coordinate[1] <= 90:
            parser.error("Coordinates must be finite [longitude, latitude] pairs")
    with SessionLocal() as db:
        geometry = func.ST_GeogFromText("SRID=4326;" + db.scalar(select(func.ST_AsText(func.ST_GeomFromGeoJSON(json.dumps(geom))))))
        length = db.scalar(select(func.ST_Length(geometry))) / 1000
        route = Route(name=args.name, geometry=geometry, distance_km=length, source=args.source, public=True)
        db.add(route)
        db.commit()
        print(f"Imported route {route.id}: {length:.1f} km. This does not verify access or safety.")


if __name__ == "__main__":
    main()
