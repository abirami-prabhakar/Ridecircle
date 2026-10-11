import type { Profile, Spot, Ride, RecordedRoute } from '../../types';

export type Selection =
  | { kind: 'cyclist'; value: Profile }
  | { kind: 'spot'; value: Spot }
  | { kind: 'ride'; value: Ride }
  | { kind: 'route'; value: RecordedRoute };

export type MapArea = {
  lat: number; lon: number;
  bounds: { north: number; south: number; east: number; west: number };
};
export type Filters = { distance: string; experience: string; pace: string; category: string };
export type MapStyle = 'standard' | 'terrain' | 'cycling';

// Public neighborhood reference points, never a person's stored coordinates.
export const AREA_CENTERS: Record<string, [number, number]> = {
  Chennai: [13.05, 80.25], Mylapore: [13.03, 80.27], Adyar: [13.00, 80.26],
  Guindy: [13.01, 80.22], Teynampet: [13.04, 80.25],
};
export const initials = (name: string) => name.split(' ').map(p => p[0]).slice(0, 2).join('');
export const selectionKey = (s: Selection | null) => s ? `${s.kind}-${s.kind === 'cyclist' ? s.value.user_id : s.value.id}` : '';
export const shortDate = (date: string) => new Date(date).toLocaleString('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
});
