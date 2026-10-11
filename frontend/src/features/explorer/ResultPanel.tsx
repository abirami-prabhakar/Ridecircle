import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowUpRight, Bike, Trees, Waves, Coffee, Mountain, CalendarDays, Users, Route as RouteIcon, ChevronUp, ChevronDown, LoaderCircle, MapPin, ArrowRight } from 'lucide-react';
import type { Results } from '../../types';
import { initials, selectionKey, shortDate, type Selection } from './types';

export type ResultTab = 'all' | 'routes' | 'cyclists' | 'events' | 'spots';
const categories: {key:ResultTab;label:string}[] = [{key:'all',label:'All'},{key:'routes',label:'Routes'},{key:'cyclists',label:'People'},{key:'events',label:'Rides'},{key:'spots',label:'Places'}];
const icons = {park:Trees,beach:Waves,lake:Waves,cafe:Coffee,viewpoint:Mountain};

export function DiscoveryResult({ item, active, choose }: {item:Selection;active:boolean;choose:(s:Selection)=>void}) {
  const label = item.kind==='cyclist'?item.value.display_name:item.kind==='ride'?item.value.title:item.value.name;
  const Icon = item.kind==='spot'?(icons[item.value.category as keyof typeof icons]??Trees):item.kind==='route'?RouteIcon:CalendarDays;
  let meta = '', reason = '', eyebrow = '';
  if(item.kind==='cyclist') { meta=`${item.value.distance_km} km · ${item.value.pace} pace`;reason=item.value.reasons?.[0]??`Usually rides ${item.value.time}s`;eyebrow=`Cyclist · ${item.value.area}`; }
  if(item.kind==='spot') { meta=item.value.distance_km!=null?`${item.value.distance_km} km direct distance`:'Public destination';reason=item.value.reasons?.find(r=>r!=='Within your selected area')??'A sourced place in your selected area';eyebrow=`Destination · ${item.value.category}`; }
  if(item.kind==='ride') {meta=`${item.value.distance_km} km planned · ${item.value.attending}/${item.value.max_participants} riders`;reason=shortDate(item.value.starts_at);eyebrow=`Group ride · ${item.value.pace} pace`;}
  if(item.kind==='route') {meta=`${item.value.distance_km.toFixed(1)} km${item.value.duration_minutes?` · ${Math.round(item.value.duration_minutes)} min estimated`:''}`;reason=item.value.reasons?.[0]??'Recorded geometry in your selected area';eyebrow='Recorded cycling route';}
  const sample = (item.kind==='cyclist'||item.kind==='ride')&&item.value.is_demo;
  return <button className={`explorer-result ${active?'active':''}`} onClick={()=>choose(item)} aria-label={`Preview ${label}`} aria-pressed={active}>
    <span className={`result-thumbnail ${item.kind} ${item.kind==='spot'?item.value.category:''}`}>
      {item.kind==='cyclist'?<span className={`result-avatar avatar-color-${item.value.user_id%4}`}>{initials(label)}</span>:<Icon size={24} strokeWidth={1.4}/>}
    </span><span className="result-copy"><span className="result-eyebrow">{eyebrow}{sample&&<span className="sample-label">Sample</span>}</span>
      <strong>{label}</strong><span className="result-meta">{meta}</span><span className="result-reason">{reason}</span>
    </span><span className="result-right">{item.kind==='cyclist'&&item.value.score!=null&&<span className="compatibility">{item.value.score}%<small>match</small></span>}<ArrowUpRight size={15}/></span>
  </button>;
}

export default function ResultPanel({ results, selected, choose, tab, onTab, loading, error, retry, area, showSamples, onSamples, searchActive, clear, create }: {
  results:Results;selected:Selection|null;choose:(s:Selection)=>void;tab:ResultTab;onTab:(t:ResultTab)=>void;loading:boolean;error:string;
  retry:()=>void;area:string;showSamples:boolean;onSamples:(v:boolean)=>void;searchActive:boolean;clear:()=>void;create:()=>void;
}) {
  const [height,setHeight]=useState(38), [dragging,setDragging]=useState(false);
  const drag = useRef<{y:number;height:number;moved:boolean}|null>(null);
  const ignoreClick = useRef(false);
  const items:Selection[]=[...results.routes.map(value=>({kind:'route' as const,value})),...results.spots.map(value=>({kind:'spot' as const,value})),...results.cyclists.map(value=>({kind:'cyclist' as const,value})),...results.events.map(value=>({kind:'ride' as const,value}))];
  const filtered=items.filter(s=>tab==='all'||({route:'routes',spot:'spots',cyclist:'cyclists',ride:'events'}[s.kind]===tab));
  const selectedId=selectionKey(selected);
  function start(e:PointerEvent<HTMLButtonElement>){drag.current={y:e.clientY,height,moved:false};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}
  function move(e:PointerEvent<HTMLButtonElement>){if(!drag.current)return;const delta=drag.current.y-e.clientY;drag.current.moved=drag.current.moved||Math.abs(delta)>5;setHeight(Math.max(16,Math.min(80,drag.current.height+delta/window.innerHeight*100)));}
  function end(){if(!drag.current)return;const didMove=drag.current.moved;drag.current=null;setDragging(false);ignoreClick.current=didMove;if(didMove)setHeight(h=>h<27?16:h>58?76:38);}
  return <section className={`floating-results ${dragging?'sheet-dragging':''}`} style={{'--sheet-height':`${height}dvh`} as CSSProperties} aria-label="Discovery results">
    <button className="sheet-handle" aria-label={height>55?'Collapse discovery results':'Expand discovery results'} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClick={()=>{if(ignoreClick.current){ignoreClick.current=false;return;}setHeight(h=>h>55?38:76);}}><span/></button>
    <div className="results-heading"><div><span className="overline">YOUR NEXT ADVENTURE</span><h2>{loading?'Finding your circle…':`${items.length} discoveries nearby`}</h2><p><MapPin size={11}/>{area}{searchActive?' · matched to your request':''}</p></div><button className="sheet-expand" aria-label={height>55?'Show less results':'Show more results'} onClick={()=>setHeight(h=>h>55?38:76)}>{height>55?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button>{searchActive&&<button className="clear-search" onClick={clear}>Clear search</button>}</div>
    <div className="result-tabs" role="tablist" aria-label="Discovery result types">{categories.map(c=><button key={c.key} role="tab" aria-selected={tab===c.key} onClick={()=>onTab(c.key)}>{c.label}<span>{c.key==='all'?items.length:results[c.key].length}</span></button>)}</div>
    <div className="results-scroll" role="tabpanel">
      {loading?<div className="explorer-state" role="status"><LoaderCircle className="spin" size={23}/><h3>Looking around the next bend.</h3><p>Searching real places, cyclists, and rides in this area.</p></div>:error?<div className="explorer-state error-state" role="alert"><h3>We couldn’t finish this search.</h3><p>{error}</p><button onClick={retry}>Use manual filters<ArrowRight size={14}/></button></div>:filtered.length?filtered.map(item=><DiscoveryResult key={selectionKey(item)} item={item} active={selectedId===selectionKey(item)} choose={choose}/>):<div className="explorer-state"><Bike size={30} strokeWidth={1.2}/><h3>{tab==='routes'?'A path worth discovering.':'A little further, perhaps?'}</h3><p>{tab==='routes'?'No recorded routes in this search. Open a sourced place to calculate a cycling route.':'No matching records here. Try a wider search, fewer filters, or another part of the map.'}</p>{tab==='events'&&<button onClick={create}>Organize the first ride<ArrowRight size={14}/></button>}</div>}
    </div>
    <div className="results-footer"><label><input type="checkbox" checked={showSamples} onChange={e=>onSamples(e.target.checked)}/>Include sample riders & rides</label><span className="data-dot" title="Destinations are sourced records. Sample people and events are fictional."/></div>
  </section>;
}
