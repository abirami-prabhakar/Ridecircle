import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon } from 'leaflet';
import { Coffee, Trees, Waves, Mountain, Sprout, Landmark, Bike, Flag } from 'lucide-react';
import type { Profile } from '../../types';
import { initials } from './types';

const illustrations = { park: Trees, lake: Waves, beach: Waves, cafe: Coffee, viewpoint: Mountain, trail: Sprout, historic: Landmark };

export function placeIcon(category: string, active = false) {
  const Illustration = illustrations[category as keyof typeof illustrations] ?? Sprout;
  return divIcon({ className: 'explorer-div-icon', iconSize: [46, 54], iconAnchor: [23, 48],
    html: renderToStaticMarkup(<span className={`illustrated-marker ${category} ${active ? 'is-selected' : ''}`}><Illustration size={23} strokeWidth={1.5}/><span className="marker-dot"/></span>) });
}

export function cyclistIcon(cyclists: Profile[], active = false) {
  return divIcon({ className: 'explorer-div-icon', iconSize: cyclists.length > 1 ? [76, 48] : [44, 44], iconAnchor: [22, 22],
    html: renderToStaticMarkup(<span className={`cyclist-map-group ${active ? 'is-selected' : ''} ${cyclists.length > 1 ? 'is-cluster' : ''}`}>
      {cyclists.slice(0, 3).map(p => <span key={p.user_id} className={`map-avatar avatar-color-${p.user_id % 4}`}>{initials(p.display_name)}</span>)}
      {cyclists.length > 1 && <span className="cluster-count">{cyclists.length}</span>}
      {cyclists.some(p => p.is_demo) && <span className="marker-sample-dot"/>}
    </span>) });
}

export function rideIcon(active = false) {
  return divIcon({ className: 'explorer-div-icon', iconSize: [38, 38], iconAnchor: [19, 19],
    html: renderToStaticMarkup(<span className={`ride-map-icon ${active ? 'is-selected' : ''}`}><Bike size={18}/></span>) });
}

export function endpointIcon(end: boolean) {
  return divIcon({ className: 'explorer-div-icon', iconSize: [27, 27], iconAnchor: [13, 13],
    html: renderToStaticMarkup(<span className={`route-endpoint ${end ? 'end' : 'start'}`}>{end ? <Flag size={12}/> : <span/>}</span>) });
}
