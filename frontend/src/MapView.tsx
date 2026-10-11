import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { Spot, RecordedRoute } from './types';
function Move({ lat, lon }: {lat: number; lon: number}) { const map = useMap(); useEffect(() => { map.setView([lat, lon], 12); }, [lat, lon, map]); return null; }
export default function MapView({ spots, routes, lat, lon, select }: { spots: Spot[]; routes: RecordedRoute[]; lat: number; lon: number; select: (s: Spot) => void }) {
  return <MapContainer center={[lat, lon]} zoom={12} scrollWheelZoom={false} className="map" aria-label="Destination map">
    <Move lat={lat} lon={lon}/>
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://routing.openstreetmap.de/about.html">FOSSGIS routing</a> | <a href="https://www.openstreetmap.org/fixthemap">Fix the map</a>'/>
    <CircleMarker center={[lat, lon]} radius={7} pathOptions={{ color: '#637ba5', fillOpacity: .9 }}><Popup>Your selected discovery area</Popup></CircleMarker>
    {spots.map(s => <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2d644d', fillOpacity: 1 }}><Popup><strong>{s.name}</strong><p>{s.category}</p><button onClick={() => select(s)}>View destination</button></Popup></CircleMarker>)}
    {routes.map(r => <Polyline key={r.id} positions={r.geometry.coordinates.map(([x, y]) => [y, x])} pathOptions={{ color: '#d89542', weight: 4 }}><Popup>{r.name} · {r.distance_km.toFixed(1)} km<br/>{r.source}</Popup></Polyline>)}
  </MapContainer>;
}
