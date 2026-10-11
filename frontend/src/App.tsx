import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, Link } from 'react-router-dom';
import { Bike, Compass, Users, MapPinned, CalendarDays, UserRound, ArrowUpRight, ArrowRight, MapPin, SlidersHorizontal, Sparkles, Clock3, X, Check, Leaf, ChevronRight, LogOut, Plus, Route as RouteIcon, ShieldCheck, Search, LoaderCircle, Coffee } from 'lucide-react';
import { api, json } from './api';
import type { Profile, Spot, Ride, RecordedRoute, SearchResponse, Results } from './types';
import MapView from './MapView';
import Explorer from './features/explorer/Explorer';
import type { MapArea } from './features/explorer/types';

const empty: Results = { cyclists: [], spots: [], events: [], routes: [] };
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const interests = ['nature', 'fitness', 'photography', 'exploration', 'endurance', 'coffee', 'coast'];
const areas: Record<string, [number, number]> = { Chennai: [13.05, 80.25], Mylapore: [13.03, 80.27], Adyar: [13.00, 80.26], Guindy: [13.01, 80.22], Teynampet: [13.04, 80.25] };
const dateLabel = (date: string) => new Date(date).toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const initials = (name: string) => name.split(' ').map(p => p[0]).slice(0, 2).join('');

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const root = ref.current!;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')).filter(e => !e.hasAttribute('disabled'));
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const nodes = focusables(), first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previous; prior?.focus(); };
  }, [close]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}><div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></div>;
}

function Auth({ done }: { done: () => Promise<void> }) {
  const [register, setRegister] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget);
    try { await api(register ? '/auth/register' : '/auth/login', json('POST', { email: f.get('email'), password: f.get('password'), ...(register ? { display_name: f.get('name') } : {}) })); await done(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="auth-screen"><section className="auth-story"><Link className="brand" to="/"><span><Bike size={25}/></span>RideCircle<span className="brand-dot">.</span></Link><div><span className="eyebrow">MORE THAN THE MILES</span><h1>Good rides.<br/>Better company.</h1><p>Find your pace, your people, and a new reason to get outside.</p><div className="auth-values"><span><Users/>A circle that fits you</span><span><Leaf/>Places worth the ride</span><span><ShieldCheck/>Your privacy, your choice</span></div></div><small>A local cycling community, starting in Chennai.</small></section><section className="auth-form"><span className="eyebrow">WELCOME TO YOUR CIRCLE</span><h2>{register ? 'Let’s get you rolling.' : 'Your next ride starts here.'}</h2><p className="muted">{register ? 'Create a profile and find a ride that feels like you.' : 'Sign in to discover cyclists, places, and group rides.'}</p><form onSubmit={submit}>{register && <label>Display name<input name="name" minLength={2} maxLength={60} autoComplete="nickname" required placeholder="What should we call you?"/></label>}<label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label><label>Password<input name="password" type="password" minLength={10} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} required placeholder="At least 10 characters"/></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : null}{register ? 'Create my account' : 'Sign in'}<ArrowRight size={16}/></button></form><p className="auth-switch">{register ? 'Already have an account?' : 'New to RideCircle?'} <button onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Sign in' : 'Create an account'}</button></p><p className="privacy-note"><ShieldCheck size={15}/>Your profile starts private. Choose discoverability in your profile.</p></section></div>;
}

function ProfilePage({ profile, saved, notify }: { profile: Profile; saved: (p: Profile) => void; notify: (s: string) => void }) {
  const [data, setData] = useState(profile), [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocks, setBlocks] = useState<{user_id:number;display_name:string}[]>([]);
  useEffect(() => { api<typeof blocks>('/blocks').then(setBlocks).catch(() => {}); }, []);
  function change(key: keyof Profile, value: unknown) { setData(d => ({ ...d, [key]: value })); }
  function toggle(key: 'interests' | 'days', value: string) { change(key, data[key].includes(value) ? data[key].filter(v => v !== value) : [...data[key], value]); }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const { user_id, is_demo, score, reasons, ...body } = data;
    try { const p = await api<Profile>('/profiles/me', json('PUT', body)); saved(p); notify('Your cycling preferences have been saved.'); }
    catch(err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <><PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Your cycling profile" text="A few preferences help you find people who enjoy the same kind of ride."/><form className="panel profile-form" onSubmit={submit}>
    <div className="profile-intro"><span className="avatar large">{initials(data.display_name)}</span><div><h3>Tell your circle a little about you</h3><p className="muted">Only your display name, broad area, and ride preferences appear in discovery.</p></div></div>
    <div className="form-grid"><label>Display name<input required minLength={2} maxLength={60} value={data.display_name} onChange={e => change('display_name', e.target.value)}/></label><label>Broad discovery area<select value={data.area in areas ? data.area : 'custom'} onChange={e => { const a = e.target.value; if (areas[a]) setData(d => ({...d, area:a, lat:areas[a][0], lon:areas[a][1]})); else change('area','Custom area'); }}>{Object.keys(areas).map(a => <option key={a}>{a}</option>)}<option value="custom">Custom area</option></select></label>
    {!(data.area in areas) && <><label>Area name<input required value={data.area} onChange={e => change('area', e.target.value)}/></label><label>Approximate latitude<input type="number" step=".01" min="-90" max="90" required value={data.lat} onChange={e => change('lat', Number(e.target.value))}/></label><label>Approximate longitude<input type="number" step=".01" min="-180" max="180" required value={data.lon} onChange={e => change('lon', Number(e.target.value))}/></label></>}
    <label>Experience<select value={data.experience} onChange={e => change('experience', e.target.value)}>{['beginner','intermediate','advanced'].map(v => <option key={v}>{v}</option>)}</select></label><label>Preferred distance (km)<input type="number" min="1" max="500" required value={data.distance_km} onChange={e => change('distance_km', Number(e.target.value))}/></label><label>Usual pace<select value={data.pace} onChange={e => change('pace', e.target.value)}>{['relaxed','moderate','fast'].map(v => <option key={v}>{v}</option>)}</select></label><label>Ride style<select value={data.ride_type} onChange={e => change('ride_type', e.target.value)}>{['casual','fitness','adventure','commuting'].map(v => <option key={v}>{v}</option>)}</select></label><label>Usual time<select value={data.time} onChange={e => change('time',e.target.value)}>{['morning','afternoon','evening'].map(v => <option key={v}>{v}</option>)}</select></label><label>Preferred group size<input type="number" required min="2" max="50" value={data.group_size} onChange={e => change('group_size',Number(e.target.value))}/></label></div>
    <label>About you<textarea maxLength={1000} value={data.bio} onChange={e => change('bio',e.target.value)} placeholder="What makes a great ride for you?"/></label>
    <fieldset><legend>What do you ride for?</legend><div className="choice-row">{interests.map(i => <button type="button" key={i} aria-pressed={data.interests.includes(i)} className={data.interests.includes(i) ? 'choice selected' : 'choice'} onClick={() => toggle('interests',i)}>{data.interests.includes(i) && <Check size={14}/>} {i}</button>)}</div></fieldset>
    <fieldset><legend>When do you usually ride?</legend><div className="choice-row">{days.map(d => <button type="button" key={d} aria-pressed={data.days.includes(d)} className={data.days.includes(d) ? 'choice selected' : 'choice'} onClick={() => toggle('days',d)}>{d}</button>)}</div></fieldset>
    <label className="privacy-toggle"><ShieldCheck/><span><strong>Appear in cyclist discovery</strong><small>Other signed-in cyclists can find your public profile. Coordinates stay private.</small></span><input type="checkbox" checked={!!data.discoverable} onChange={e => change('discoverable',e.target.checked)}/></label>
    {error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}<Check size={16}/></button>
  </form><div className="panel account-panel"><h3>Blocked cyclists</h3>{blocks.length ? blocks.map(b => <p key={b.user_id}>{b.display_name}<button className="text-button" onClick={async () => { try { await api('/blocks/'+b.user_id,json('DELETE')); setBlocks(bs=>bs.filter(x=>x.user_id!==b.user_id)); notify('Cyclist unblocked.'); } catch(err) { notify((err as Error).message); } }}>Unblock</button></p>) : <p className="muted">You haven’t blocked anyone.</p>}<hr/><h3>Delete account</h3><p className="muted">Permanently removes your profile, organized events, RSVPs, blocks, and reports.</p><button type="button" className="danger-button" onClick={async () => { if (window.confirm('Permanently delete your RideCircle account and its data?')) { try { await api('/account',json('DELETE')); window.location.assign('/'); } catch(err) { notify((err as Error).message); } } }}>Delete my account</button></div></>;
}

function PageHeading({eyebrow, title, text, action}: {eyebrow:string;title:string;text:string;action?:ReactNode}) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted">{text}</p></div>{action}</div>; }

export default function App() {
  const [profile,setProfile] = useState<Profile|null>(null), [boot,setBoot] = useState(true), [bootError,setBootError] = useState('');
  const [results,setResults] = useState<Results>(empty), [searchInfo,setSearchInfo] = useState<SearchResponse|null>(null), [loading,setLoading] = useState(false), [error,setError] = useState('');
  const [query,setQuery] = useState(''), [area,setArea] = useState('Chennai'), [radius,setRadius] = useState(25);
  const [filters,setFilters] = useState({distance:'',experience:'',pace:'',category:''}), [filterOpen,setFilterOpen] = useState(false);
  const [selected,setSelected] = useState<{kind:'cyclist';value:Profile}|{kind:'spot';value:Spot}|{kind:'ride';value:Ride}|null>(null), [createOpen,setCreateOpen] = useState(false);
  const [toast,setToast] = useState(''), [modalError,setModalError] = useState(''), [actionBusy,setActionBusy] = useState(false), [plannedRoute,setPlannedRoute] = useState<RecordedRoute|null>(null);
  const [health,setHealth] = useState<{ai_mode:string}|null>(null);
  const navigate = useNavigate(), location = useLocation();
  const [mapArea, setMapArea] = useState<MapArea|null>(null);
  const requestVersion = useRef(0);
  const notify = useCallback((message:string) => setToast(message),[]);
  useEffect(() => { if(toast) { const timer=setTimeout(()=>setToast(''),5000); return ()=>clearTimeout(timer); } },[toast]);
  const refreshProfile = useCallback(async () => { const p=await api<Profile>('/profiles/me'); setProfile(p); if(p.area in areas) setArea(p.area); },[]);
  useEffect(() => { api('/health').then(h=>setHealth(h as {ai_mode:string})).catch(()=>{}); refreshProfile().catch(err => { if(!(err as Error).message.includes('Sign in')) setBootError((err as Error).message); }).finally(()=>setBoot(false)); },[refreshProfile]);
  const [lat,lon] = mapArea ? [mapArea.lat,mapArea.lon] : areas[area] ?? [profile?.lat ?? 13.05, profile?.lon ?? 80.25];
  const runFilters = useCallback(async () => {
    if(!profile) return;
    const version = ++requestVersion.current;
    setLoading(true); setError(''); setResults(empty);
    const params = new URLSearchParams({lat:String(lat),lon:String(lon),radius_km:String(radius)});
    if(mapArea) Object.entries(mapArea.bounds).forEach(([k,v])=>params.set(k,String(v)));
    const map = {distance:'distance_km',experience:'experience',pace:'pace',category:'category'};
    Object.entries(filters).forEach(([k,v])=>{if(v)params.set(map[k as keyof typeof map],v);});
    try { const data=await api<SearchResponse>('/discover?'+params); if(version===requestVersion.current){setResults(data.results);setSearchInfo(data);} }
    catch(err) { if(version===requestVersion.current)setError((err as Error).message); } finally { if(version===requestVersion.current)setLoading(false); }
  },[profile,lat,lon,radius,filters,mapArea]);
  useEffect(()=>{ void runFilters(); },[runFilters]);
  async function search(e:FormEvent) {
    e.preventDefault(); if(!query.trim()) { await runFilters(); return; }
    const version=++requestVersion.current;
    setLoading(true); setError(''); setResults(empty);
    try { const data=await api<SearchResponse>('/ai/discover',json('POST',{query,lat,lon,radius_km:radius,...(mapArea?{bounds:mapArea.bounds}:{})})); if(version===requestVersion.current){setResults(data.results);setSearchInfo(data);} }
    catch(err) { if(version===requestVersion.current)setError((err as Error).message); } finally { if(version===requestVersion.current)setLoading(false); }
  }
  const closeModal = useCallback(()=>{setSelected(null);setCreateOpen(false);setModalError('');setPlannedRoute(null);},[]);
  function open(kind:'cyclist'|'spot'|'ride',value:Profile|Spot|Ride) {
    setSelected({kind,value} as typeof selected); setModalError(''); setPlannedRoute(null);
    if(kind==='ride') api<Ride>('/events/'+(value as Ride).id).then(v=>setSelected(s=>s?.kind==='ride'&&s.value.id===v.id?{kind:'ride',value:v}:s)).catch(err=>setModalError((err as Error).message));
  }
  async function action(fn:()=>Promise<unknown>, message:string) { setActionBusy(true);setModalError('');try {await fn();notify(message); await runFilters();}catch(err){setModalError((err as Error).message);}finally{setActionBusy(false);} }
  async function doRSVP(ride:Ride,status:string) { await action(async()=>{const updated=await api<Ride>('/events/'+ride.id+'/rsvps',json('POST',{status}));setSelected({kind:'ride',value:updated});},status==='attending'?'You’re on the ride!':'Marked as interested.'); }
  async function createRide(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const form=new FormData(e.currentTarget);
    await action(async()=>{const ride=await api<Ride>('/events',json('POST',{title:form.get('title'),description:form.get('description'),start_area:form.get('start_area'),starts_at:new Date(String(form.get('starts_at'))+'+05:30').toISOString(),distance_km:Number(form.get('distance')),pace:form.get('pace'),experience:form.get('experience'),max_participants:Number(form.get('capacity')),lat,lon,route_id:form.get('route_id')?Number(form.get('route_id')):null}));setCreateOpen(false);setSelected({kind:'ride',value:ride});navigate('/rides');},'Your group ride has been created.');
  }
  if(boot) return <div className="boot"><Bike size={40}/><p>Getting your circle ready…</p></div>;
  if(!profile) return <>{bootError&&<div className="connection-error" role="alert">{bootError}<button onClick={()=>window.location.reload()}>Retry</button></div>}<Auth done={async()=>{await refreshProfile();navigate('/profile');}}/></>;
  return <div className="ridecircle-shell">
    <header className="explorer-header">
      <Link className="explorer-brand" to="/"><span className="brand-emblem"><Bike size={25} strokeWidth={1.5}/></span><span>RideCircle<span className="wordmark-dot">.</span><small>GO FURTHER, TOGETHER</small></span></Link>
      <nav className="explorer-navigation" aria-label="Main navigation">
        <NavLink to="/" end><Compass size={15}/>Discover</NavLink>
        <NavLink to="/cyclists"><Users size={15}/>Find cyclists</NavLink>
        <NavLink to="/places"><MapPinned size={15}/>Places & routes</NavLink>
        <NavLink to="/rides"><CalendarDays size={15}/>Group rides</NavLink>
      </nav>
      <div className="explorer-header-actions">
        <label className="explorer-area"><MapPin size={14}/><select aria-label="Search area" value={area} onChange={e=>{setArea(e.target.value);setMapArea(null);}}>{Object.keys(areas).map(a=><option key={a}>{a}</option>)}{!(profile.area in areas)&&<option value={profile.area}>{profile.area}</option>}</select></label>
        <button className="organize-button" onClick={()=>setCreateOpen(true)}><Plus size={15}/><span>Create a ride</span></button>
        <NavLink className="header-profile" to="/profile" aria-label="My profile"><span>{initials(profile.display_name)}</span></NavLink>
        <button className="header-logout" aria-label="Sign out" onClick={async()=>{try{await api('/auth/logout',json('POST'));setProfile(null);setResults(empty);setMapArea(null);}catch(err){notify((err as Error).message);}}}><LogOut size={16}/></button>
      </div>
    </header>
    <Routes>
      <Route path="/profile" element={<main className="explorer-profile-page"><ProfilePage profile={profile} saved={setProfile} notify={notify}/></main>}/>
      <Route path="*" element={<Explorer results={results} lat={lat} lon={lon} area={mapArea?'Selected map area':area}
        query={query} setQuery={setQuery} submit={search} searchInfo={searchInfo} loading={loading} error={error}
        filters={filters} setFilters={setFilters} radius={radius} setRadius={setRadius} retry={()=>void runFilters()}
        clear={()=>{setQuery('');void runFilters();}} open={open} create={()=>setCreateOpen(true)} aiMode={health?.ai_mode??'rules'}
        initialTab={location.pathname==='/cyclists'?'cyclists':location.pathname==='/places'?'spots':location.pathname==='/rides'?'events':'all'}
        onMapArea={newArea=>{setMapArea(newArea);setQuery('');}} viewportSearch={!!mapArea}/>}/>
    </Routes>
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={15}/></button></div>}
    {selected&&<Modal title={selected.kind==='cyclist'?selected.value.display_name:selected.kind==='spot'?selected.value.name:selected.value.title} close={closeModal}>
      {selected.kind==='cyclist'&&<><div className="detail-intro"><span className="avatar large">{initials(selected.value.display_name)}</span><div><p><MapPin size={15}/>{selected.value.area}</p><div className="tags"><span>{selected.value.experience}</span><span>{selected.value.pace} pace</span><span>{selected.value.distance_km} km</span>{selected.value.is_demo&&<span>Sample profile</span>}</div></div></div><p>{selected.value.bio}</p><h3>Why you might click</h3><ul className="reason-list">{(selected.value.reasons??['Public profile in your discovery area']).map(r=><li key={r}><Check size={15}/>{r}</li>)}</ul><p className="muted">Usually rides {selected.value.days.join(', ')} in the {selected.value.time}.</p><div className="tags">{selected.value.interests.map(i=><span key={i}>{i}</span>)}</div><div className="modal-actions"><button className="secondary" disabled={actionBusy} onClick={()=>{const id=selected.value.user_id;void action(async()=>{await api('/blocks/'+id,json('POST'));closeModal();},'Cyclist blocked. You will no longer see each other in discovery.');}}>Block cyclist</button><button className="text-button" disabled={actionBusy} onClick={()=>{const reason=window.prompt('Describe the issue (at least 10 characters). Reports are saved for local administrator review.');if(reason)void action(()=>api('/reports',json('POST',{target_type:'cyclist',target_id:selected.value.user_id,reason})),'Report saved for administrator review.');}}>Report profile</button></div></>}
      {selected.kind==='spot'&&<><div className="tags"><span>{selected.value.category}</span>{selected.value.tags.map(t=><span key={t}>{t}</span>)}</div><p>{selected.value.description}</p><p className="source-note">{selected.value.source_note}</p><a className="source-link" href={selected.value.source_url} target="_blank" rel="noreferrer">View geographic source<ArrowUpRight size={15}/></a><MapView spots={[selected.value]} routes={plannedRoute?[plannedRoute]:[]} lat={lat} lon={lon} select={()=>{}}/><p className="map-note">A marker is a destination, not a verified cycling entrance.</p>{plannedRoute?<div className="panel"><h3>{plannedRoute.name}</h3><p>{plannedRoute.distance_km.toFixed(1)} km · {Math.round(plannedRoute.duration_minutes??0)} min provider estimate</p><small>{plannedRoute.source}. Check local access and conditions before riding.</small></div>:<button className="primary" disabled={actionBusy} onClick={()=>{const spot=selected.value;void action(async()=>{const route=await api<RecordedRoute>('/routes/plan',json('POST',{lat,lon,spot_id:spot.id,name:area+' to '+spot.name}));setPlannedRoute(route);},'Cycling route calculated and saved privately.');}}><RouteIcon size={16}/>Calculate cycling route from {area}</button>}</>}
      {selected.kind==='ride'&&<><div className="tags"><span className="status">{selected.value.status}</span><span>{selected.value.experience}</span>{selected.value.is_demo&&<span>Sample event</span>}</div><p>{selected.value.description}</p><div className="ride-detail-grid"><span><CalendarDays/>{dateLabel(selected.value.starts_at)} IST</span><span><MapPin/>{selected.value.start_area}</span><span><RouteIcon/>{selected.value.distance_km} km planned · {selected.value.pace}</span><span><Users/>{selected.value.attending}/{selected.value.max_participants} attending</span></div><p className="muted">Organized by {selected.value.organizer}. {selected.value.route_id?'A recorded route is linked.':'No verified route linked. The listed distance is a planning target.'}</p><h3>Who’s coming</h3><div className="tags">{selected.value.participants?.map((p,i)=><span key={i}>{p.display_name}</span>)??<span>Reopen the ride to view participant names.</span>}</div><div className="modal-actions">{selected.value.my_rsvp?<><button className="secondary" disabled={actionBusy} onClick={()=>{const ride=selected.value;void action(async()=>{await api('/events/'+ride.id+'/rsvps/me',json('DELETE'));setSelected({kind:'ride',value:await api<Ride>('/events/'+ride.id)});},'You’ve left this ride.');}}>Leave ride</button>{selected.value.my_rsvp==='interested'&&<button className="primary" disabled={actionBusy||selected.value.is_full||selected.value.status==='cancelled'} onClick={()=>doRSVP(selected.value,'attending')}>Join ride</button>}</>:<><button className="secondary" disabled={actionBusy||selected.value.status==='cancelled'} onClick={()=>doRSVP(selected.value,'interested')}>Interested</button><button className="primary" disabled={actionBusy||selected.value.is_full||selected.value.status==='cancelled'} onClick={()=>doRSVP(selected.value,'attending')}>{selected.value.is_full?'Ride is full':'Join ride'}<ArrowRight size={16}/></button></>}</div>{selected.value.organizer_id===profile.user_id&&<label>Organizer: event status<select value={selected.value.status} disabled={actionBusy} onChange={e=>{const id=selected.value.id;void action(async()=>{const ride=await api<Ride>('/events/'+id+'/status?status='+e.target.value,json('PATCH'));setSelected({kind:'ride',value:ride});},'Ride status updated.');}}>{['planned','confirmed','cancelled'].map(v=><option key={v}>{v}</option>)}</select></label>}<button className="text-button" onClick={()=>{const reason=window.prompt('Describe the issue (at least 10 characters).');if(reason)void action(()=>api('/reports',json('POST',{target_type:'event',target_id:selected.value.id,reason})),'Report saved for administrator review.');}}>Report ride</button></>}
      {modalError&&<p className="error" role="alert">{modalError}</p>}{actionBusy&&<p className="muted" role="status">Saving…</p>}
    </Modal>}
    {createOpen&&<Modal title="Bring your circle together" close={closeModal}><p className="muted">Keep it simple. A place to meet, a pace to share, and a little fresh air.</p><form onSubmit={createRide} className="event-form"><label>Ride name<input name="title" required minLength={3} maxLength={120} placeholder="Sunday morning, easy miles"/></label><label>Public meeting point<input name="start_area" required minLength={3} maxLength={120} placeholder="A public landmark — not your home"/></label><p className="map-note">Meeting area: {area}. This point is public. Select your search area before creating a ride.</p><label>Date and time (IST)<input type="datetime-local" name="starts_at" required/></label><div className="form-grid"><label>Planned distance (km)<input name="distance" type="number" min="1" max="500" required defaultValue={20}/></label><label>Maximum participants<input name="capacity" type="number" min="2" max="100" required defaultValue={6}/></label><label>Pace<select name="pace">{['relaxed','moderate','fast'].map(v=><option key={v}>{v}</option>)}</select></label><label>Experience<select name="experience">{['beginner','intermediate','advanced'].map(v=><option key={v}>{v}</option>)}</select></label></div><label>Recorded route (optional)<select name="route_id"><option value="">No route linked — distance is a plan</option>{results.routes.map(r=><option value={r.id} key={r.id}>{r.name} · {r.distance_km.toFixed(1)} km</option>)}</select></label><label>A little about the ride<textarea name="description" maxLength={2000} placeholder="What should people know before joining?"/></label>{modalError&&<p className="error" role="alert">{modalError}</p>}<button className="primary" disabled={actionBusy}>{actionBusy?'Creating…':'Create group ride'}<ArrowRight size={16}/></button></form></Modal>}
  </div>;
}

