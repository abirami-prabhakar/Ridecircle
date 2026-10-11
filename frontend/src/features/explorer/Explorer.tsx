import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search, ArrowRight, SlidersHorizontal, Compass, Leaf, Coffee, Users, CalendarDays, Check, LoaderCircle, X, Route as RouteIcon, MapPinned } from 'lucide-react';
import type { Profile, Results, SearchResponse, Spot, Ride } from '../../types';
import AdventureMap from './AdventureMap';
import ResultPanel, { type ResultTab } from './ResultPanel';
import SelectionPreview from './SelectionPreview';
import { selectionKey, type Selection, type Filters, type MapArea, type MapStyle } from './types';

const preferences=[{label:'Beginner friendly',query:'Find beginner cyclists',icon:Users},{label:'Scenic routes',query:'Find scenic cycling routes',icon:Leaf},{label:'Weekend rides',query:'Find weekend group rides',icon:CalendarDays},{label:'Coffee stops',query:'Find cafe destinations with coffee',icon:Coffee},{label:'Find cycling friends',query:'Find cyclists who enjoy nature',icon:Users}];

export default function Explorer({results,lat,lon,area,query,setQuery,submit,searchInfo,loading,error,filters,setFilters,radius,setRadius,retry,clear,open,create,aiMode,initialTab,onMapArea,viewportSearch=false}: {
  results:Results;lat:number;lon:number;area:string;query:string;setQuery:(q:string)=>void;submit:(e:FormEvent)=>void;searchInfo:SearchResponse|null;
  loading:boolean;error:string;filters:Filters;setFilters:(f:Filters)=>void;radius:number;setRadius:(r:number)=>void;
  retry:()=>void;clear:()=>void;open:(kind:'cyclist'|'spot'|'ride',value:Profile|Spot|Ride)=>void;create:()=>void;aiMode:string;
  initialTab:ResultTab;onMapArea:(area:MapArea)=>void;viewportSearch?:boolean;
}) {
  const [selected,setSelected]=useState<Selection|null>(null), [tab,setTab]=useState<ResultTab>(initialTab);
  const [showSamples,setShowSamples]=useState(true), [filterOpen,setFilterOpen]=useState(false), [mapStyle,setMapStyle]=useState<MapStyle>('standard');
  const [currentViewport,setCurrentViewport]=useState<MapArea|null>(null), [searchedViewport,setSearchedViewport]=useState<MapArea|null>(null), [reset,setReset]=useState(0);
  const [preference,setPreference]=useState('');
  const rendered=useMemo(()=>({...results,cyclists:results.cyclists.filter(p=>showSamples||!p.is_demo),events:results.events.filter(r=>showSamples||!r.is_demo)}),[results,showSamples]);
  useEffect(()=>{setTab(initialTab);},[initialTab]);
  useEffect(()=>{setSelected(null);},[lat,lon]);
  useEffect(()=>{
    if(!selected)return;
    const exists=selected.kind==='cyclist'?rendered.cyclists.some(p=>p.user_id===selected.value.user_id):selected.kind==='spot'?rendered.spots.some(p=>p.id===selected.value.id):selected.kind==='ride'?rendered.events.some(p=>p.id===selected.value.id):rendered.routes.some(p=>p.id===selected.value.id);
    if(!exists)setSelected(null);
  },[rendered,selected]);
  const moved=useCallback((a:MapArea,reset=false)=>{setCurrentViewport(a);setSearchedViewport(old=>reset?a:old??a);},[]);
  const viewportChanged=currentViewport&&searchedViewport&&(Math.abs(currentViewport.lat-searchedViewport.lat)>.004||Math.abs(currentViewport.lon-searchedViewport.lon)>.004||Math.abs(currentViewport.bounds.north-searchedViewport.bounds.north)>.004);
  function choose(s:Selection){setSelected(s);}
  function applyPreference(label:string,text:string){setPreference(label===preference?'':label);setQuery(label===preference?'':text);}
  const filterCount=Object.values(filters).filter(Boolean).length;
  return <section className={`explorer-screen ${selected?'has-preview':''}`} aria-label="RideCircle map explorer">
    <AdventureMap results={rendered} lat={lat} lon={lon} selected={selected} choose={choose} onViewport={moved} mapStyle={mapStyle} onStyle={setMapStyle} reset={reset} preserveViewport={viewportSearch}/>
    <div className="floating-discovery-column"><section className="floating-search" aria-label="Ride discovery search">
      <div className="explorer-intro"><span className="overline"><span className="orange-dash"/> A WORLD WORTH RIDING</span><h1>Your next ride<br/>{' '}is <em>out there.</em></h1><p>Find your people. Follow your curiosity.</p></div>
      <form className="map-discovery-form" onSubmit={e=>{setSelected(null);setTab('all');submit(e);}}><Search size={19}/><textarea rows={2} aria-label="Describe your ideal ride" value={query} onChange={e=>{setQuery(e.target.value);setPreference('');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} placeholder="Find a scenic 20 km ride with people who match my pace..." maxLength={1000}/><button aria-label="Find my ride" disabled={loading}>{loading?<LoaderCircle size={18} className="spin"/>:<ArrowRight size={20}/>}</button></form>
      <div className="explorer-preferences">{preferences.map(p=><button key={p.label} aria-pressed={preference===p.label} className={preference===p.label?'active':''} onClick={()=>applyPreference(p.label,p.query)}>{preference===p.label?<Check size={12}/>:<p.icon size={12}/>} {p.label}</button>)}</div>
      <div className="search-panel-footer"><span><span className="engine-dot"/>{aiMode==='ollama'?'Gemma discovery':'Keyword discovery'}<span className="search-area-dot">·</span>{radius} km area</span><button onClick={()=>setFilterOpen(!filterOpen)} aria-expanded={filterOpen}><SlidersHorizontal size={13}/>Filters{filterCount>0&&<b>{filterCount}</b>}</button></div>
      {filterOpen&&<div className="map-filter-panel"><div className="filter-panel-heading"><strong>A ride that fits</strong><button aria-label="Close filters" onClick={()=>setFilterOpen(false)}><X size={16}/></button></div><div className="map-filter-grid">
        <label>Search radius (km)<input type="number" min={1} max={100} value={radius} onChange={e=>setRadius(Math.min(100,Math.max(1,Number(e.target.value))))}/></label>
        <label>Ride distance (km)<input type="number" min={1} max={500} value={filters.distance} placeholder="Any" onChange={e=>setFilters({...filters,distance:e.target.value})}/></label>
        <label>Experience<select value={filters.experience} onChange={e=>setFilters({...filters,experience:e.target.value})}><option value="">All levels</option>{['beginner','intermediate','advanced'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Pace<select value={filters.pace} onChange={e=>setFilters({...filters,pace:e.target.value})}><option value="">Any pace</option>{['relaxed','moderate','fast'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Place type<select value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">All places</option>{['park','beach','lake','cafe','viewpoint','historic'].map(v=><option key={v}>{v}</option>)}</select></label>
        <button className="filter-reset" onClick={()=>{setFilters({distance:'',experience:'',pace:'',category:''});setPreference('');}}>Reset preferences</button>
      </div><p>Filters update the map and results automatically.</p></div>}
    </section>
    <ResultPanel results={rendered} selected={selected} choose={choose} tab={tab} onTab={setTab} loading={loading} error={error} retry={retry} area={area} showSamples={showSamples} onSamples={setShowSamples} searchActive={!!searchInfo&&searchInfo.engine!=='filters'} clear={()=>{setPreference('');setSelected(null);clear();}} create={create}/>
    </div>
    {viewportChanged&&<button className="search-this-area" disabled={loading} onClick={()=>{if(currentViewport){setSearchedViewport(currentViewport);setSelected(null);onMapArea(currentViewport);}}}><Search size={14}/>Search this area</button>}
    <div className="map-legend"><span><span className="legend-route"/>Recorded routes</span><span><span className="legend-avatar"/><span className="legend-people-label">Cyclist areas</span></span><span><MapPinned size={13}/>Places</span></div>
    <div className="map-field-note"><Compass size={16}/><span>Take the long way.<br/><strong>Find a little more.</strong></span></div>
    {selected&&<SelectionPreview key={selectionKey(selected)} selection={selected} close={()=>setSelected(null)} open={open}/>}
    {searchInfo?.engine==='keyword'&&<span className="search-mode-note">Keyword mode · enable Ollama for Gemma</span>}
    <button className="map-home-control" onClick={()=>{setSelected(null);setReset(r=>r+1);}} aria-label="Reset explorer map"><Compass size={16}/></button>
  </section>;
}
