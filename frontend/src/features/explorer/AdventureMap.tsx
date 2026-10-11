import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, ScaleControl, useMap, useMapEvents, Circle } from 'react-leaflet';
import { latLngBounds, type LatLngTuple, type Map as LeafletMap } from 'leaflet';
import { LocateFixed, Plus, Minus, Layers3, Mountain, Bike, Map as MapIcon } from 'lucide-react';
import type { Profile, Results } from '../../types';
import { AREA_CENTERS, selectionKey, type Selection, type MapArea, type MapStyle } from './types';
import { placeIcon, cyclistIcon, rideIcon, endpointIcon } from './markers';

const baseLayers = {
  standard: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19,
    credit: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  terrain: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17,
    credit: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' },
  cycling: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19,
    credit: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
};
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function viewport(map: LeafletMap): MapArea {
  const b = map.getBounds(), c = map.getCenter().wrap();
  return { lat: c.lat, lon: c.lng, bounds: { north: Math.min(90, b.getNorth()), south: Math.max(-90, b.getSouth()),
    east: Math.min(180, b.getEast()), west: Math.max(-180, b.getWest()) } };
}

function Camera({ lat, lon, selected, register, moved, reset, preserveViewport }: {
  lat: number; lon: number; selected: Selection | null; register: (m: LeafletMap) => void;
  moved: (area: MapArea, reset?: boolean) => void; reset: number; preserveViewport: boolean;
}) {
  const map = useMap();
  const positioning = useRef(false);
  const lastReset = useRef(reset);
  useMapEvents({ moveend: () => { if(!positioning.current)moved(viewport(map)); }, zoomend: () => { if(!positioning.current)moved(viewport(map)); } });
  useEffect(() => { register(map); }, [map, register]);
  useEffect(() => {
    const resetRequested = reset !== lastReset.current;
    lastReset.current = reset;
    if(preserveViewport && !resetRequested) return;
    positioning.current = true;
    map.setView([lat, lon], 13, { animate: false });
    // Leave the center of the neighborhood visible to the right of the floating panels.
    if (window.innerWidth > 760) map.panBy([-180, 0], { animate: false });
    positioning.current = false;
    moved(viewport(map), true);
  }, [lat, lon, map, reset, preserveViewport]);
  useEffect(() => {
    if (!selected) return;
    const animate = !reducedMotion();
    if (selected.kind === 'route') {
      const coords = selected.value.geometry.coordinates.map(([x, y]): LatLngTuple => [y, x]);
      if (coords.length) map.fitBounds(latLngBounds(coords), { paddingTopLeft: window.innerWidth > 760 ? [420, 90] : [30, 180],
        paddingBottomRight: window.innerWidth > 760 ? [350, 80] : [30, 310], maxZoom: 15, animate });
    } else {
      const position = selected.kind === 'cyclist' ? AREA_CENTERS[selected.value.area] : [selected.value.lat, selected.value.lon] as LatLngTuple;
      if (position) {
        const projected = map.project(position, map.getZoom());
        const offset: [number, number] = window.innerWidth > 760 ? [80, 0] : [0, 50];
        map.panTo(map.unproject(projected.subtract(offset)), { animate, duration: .35 });
      }
    }
  }, [map, selected]);
  return null;
}

function CyclistMarkers({ cyclists, selected, choose, zoom }: { cyclists: Profile[]; selected: Selection | null; choose: (s: Selection) => void; zoom: number }) {
  const map = useMap();
  const groups = useMemo(() => {
    const result: { center: LatLngTuple; members: Profile[] }[] = [];
    for (const p of cyclists) {
      const position = AREA_CENTERS[p.area];
      if (!position) continue; // Unknown areas remain in the list instead of acquiring invented coordinates.
      const existing = zoom < 14 ? result.find(g => map.project(g.center, zoom).distanceTo(map.project(position, zoom)) < 75) : undefined;
      if (existing) existing.members.push(p); else result.push({ center: position, members: [p] });
    }
    return result;
  }, [cyclists, map, zoom]);
  return <>{groups.map(group => <Marker key={group.members.map(p => p.user_id).join('-')} position={group.center}
    icon={cyclistIcon(group.members, selected?.kind === 'cyclist' && group.members.some(p => p.user_id === selected.value.user_id))}
    title={group.members.length > 1 ? `${group.members.length} cyclists in nearby areas` : `${group.members[0].display_name} — approximate area`}
    eventHandlers={{ click: () => {
      if (group.members.length > 1) map.flyTo(group.center, 15, { animate: !reducedMotion(), duration: .45 });
      else choose({ kind: 'cyclist', value: group.members[0] });
    } }}><Tooltip direction="top" offset={[0, -20]}>{group.members.length > 1 ? `${group.members.length} cyclists · zoom to explore` : group.members[0].display_name}<br/>Neighborhood reference point, not live location{group.members.some(p => p.is_demo) ? ' · sample' : ''}</Tooltip></Marker>)}</>;
}

export default function AdventureMap({ results, lat, lon, selected, choose, onViewport, mapStyle, onStyle, reset, preserveViewport }: {
  results: Results; lat: number; lon: number; selected: Selection | null; choose: (s: Selection) => void;
  onViewport: (a: MapArea, reset?: boolean) => void; mapStyle: MapStyle; onStyle: (s: MapStyle) => void; reset: number; preserveViewport: boolean;
}) {
  const [map, setMap] = useState<LeafletMap | null>(null), [zoom, setZoom] = useState(13), [tileError, setTileError] = useState(false);
  const base = baseLayers[mapStyle];
  useEffect(() => { setTileError(false); }, [mapStyle]);
  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    map.on('zoomend', update);
    return () => { map.off('zoomend', update); };
  }, [map]);
  return <div className={`adventure-map-wrap style-${mapStyle}`}>
    <MapContainer center={[lat, lon]} zoom={13} minZoom={4} maxZoom={19} zoomControl={false} className="adventure-map" aria-label="Interactive cycling discovery map" worldCopyJump>
      <Camera lat={lat} lon={lon} selected={selected} register={setMap} moved={onViewport} reset={reset} preserveViewport={preserveViewport}/>
      <TileLayer key={mapStyle} url={base.url} attribution={base.credit} maxNativeZoom={base.max} maxZoom={19}
        eventHandlers={{ tileerror: () => setTileError(true) }}/>
      <ScaleControl position="bottomright" imperial={false}/>
      <CyclistMarkers cyclists={results.cyclists} selected={selected} choose={choose} zoom={zoom}/>
      {results.spots.map(s => <Marker key={s.id} position={[s.lat, s.lon]} icon={placeIcon(s.category, selectionKey(selected) === `spot-${s.id}`)}
        title={`${s.name} — ${s.category}`} zIndexOffset={selected?.kind === 'spot' && selected.value.id === s.id ? 400 : 100}
        eventHandlers={{ click: () => choose({ kind: 'spot', value: s }) }}><Tooltip direction="top" offset={[0, -40]}>{s.name}</Tooltip></Marker>)}
      {results.events.map((r, index) => <Marker key={r.id} position={[r.lat, r.lon]} icon={rideIcon(selectionKey(selected) === `ride-${r.id}`)}
        title={`${r.title}${r.is_demo ? ' — sample ride' : ''}`} zIndexOffset={-index}
        eventHandlers={{ click: () => choose({ kind: 'ride', value: r }) }}><Tooltip direction="top">{r.title}{r.is_demo ? ' · sample' : ''}</Tooltip></Marker>)}
      {results.routes.map((r, index) => {
        const active = selectionKey(selected) === `route-${r.id}`;
        const positions = r.geometry.coordinates.map(([x,y]): LatLngTuple => [y,x]);
        if (positions.length < 2) return null;
        const color = active ? '#ba653d' : ['#245541', '#728760', '#b87549'][index % 3];
        return <Fragment key={r.id}><Polyline positions={positions} pathOptions={{ color: '#fffdf5', weight: active ? 11 : 8, opacity: .95 }} interactive={false}/>
          <Polyline key={`path-${r.id}-${active}`} className={active ? 'active-route-line' : ''} positions={positions} pathOptions={{ color, weight: active ? 6 : mapStyle==='cycling'?6:4, lineCap: 'round', opacity: 1 }}
            eventHandlers={{ click: () => choose({ kind: 'route', value: r }) }}><Tooltip sticky>{r.name} · {r.distance_km.toFixed(1)} km</Tooltip></Polyline>
          <Marker position={positions[0]} icon={endpointIcon(false)} title={`${r.name} start`} eventHandlers={{click:()=>choose({kind:'route',value:r})}}/>
          <Marker position={positions[positions.length-1]} icon={endpointIcon(true)} title={`${r.name} finish`} eventHandlers={{click:()=>choose({kind:'route',value:r})}}/>
        </Fragment>;
      })}
      {selected?.kind === 'cyclist' && AREA_CENTERS[selected.value.area] && <Circle center={AREA_CENTERS[selected.value.area]} radius={900} pathOptions={{ color: '#56795c', weight: 1, dashArray: '4 5', fillColor: '#8caa83', fillOpacity: .08 }} interactive={false}/>} 
    </MapContainer>
    <div className="map-edition"><span/>CHENNAI & BEYOND <span className="edition-rule"/> THE EXPLORER EDITION</div>
    <div className="map-tools"><div className="north-arrow" aria-label="North"><span>N</span><span className="north-needle"/></div><div className="map-zoom-tools">
      <button aria-label="Zoom in" onClick={()=>map?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>map?.zoomOut()}><Minus size={19}/></button>
    </div><button className="map-recenter" aria-label="Return to selected discovery area" onClick={()=>map?.setView([lat,lon],13,{animate:!reducedMotion()})}><LocateFixed size={19}/></button></div>
    <div className="map-style-switcher" aria-label="Map style"><span><Layers3 size={14}/>Map view</span><div>{(['standard','terrain','cycling'] as const).map(style=>{
      const Icon = style==='terrain'?Mountain:style==='cycling'?Bike:MapIcon;
      return <button key={style} aria-pressed={mapStyle===style} onClick={()=>onStyle(style)} className={mapStyle===style?'active':''}><span className={`style-thumb ${style}`}><Icon size={18}/></span>{style[0].toUpperCase()+style.slice(1)}</button>;
    })}</div><small>{mapStyle==='terrain'?'Actual terrain & contours · OpenTopoMap':mapStyle==='cycling'?'OSM with recorded-route emphasis':'OpenStreetMap · community geographic data'}</small></div>
    {tileError && <div className="tile-error" role="status">Some map tiles couldn’t load. <button onClick={()=>onStyle(mapStyle==='standard'?'terrain':'standard')}>Try another map style</button>. Retrieved markers and results remain available.</div>}
  </div>;
}
