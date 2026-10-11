export type Profile = {
  user_id: number; display_name: string; bio: string; area: string;
  experience: 'beginner' | 'intermediate' | 'advanced'; distance_km: number;
  pace: 'relaxed' | 'moderate' | 'fast'; interests: string[]; days: string[];
  time: string; ride_type: string; group_size: number; is_demo: boolean;
  lat?: number; lon?: number; discoverable?: boolean; score?: number | null; reasons?: string[];
};
export type Spot = { id: number; name: string; category: string; description: string; lat: number; lon: number; distance_km?: number; tags: string[]; source_url: string; source_note: string; reasons?: string[] };
export type Ride = { id: number; title: string; description: string; start_area: string; starts_at: string; distance_km: number; pace: string; experience: string; max_participants: number; attending: number; my_rsvp: string | null; organizer: string; organizer_id: number; status: string; is_full: boolean; is_demo: boolean; route_id: number | null; participants?: { display_name: string }[]; lat: number; lon: number };
export type RecordedRoute = { id: number; name: string; distance_km: number; duration_minutes: number | null; source: string; geometry: { type: 'LineString'; coordinates: [number, number][] }; elevation_gain_m?: number; difficulty?: string; reasons?: string[] };
export type Results = { cyclists: Profile[]; spots: Spot[]; events: Ride[]; routes: RecordedRoute[] };
export type SearchResponse = { results: Results; intent: Record<string, unknown>; engine: string; warnings: string[] };
