"use client";
import {useEffect,useMemo,useState} from "react";
import {Download,HardDrive,Pause,Search,Trash2,RefreshCw,Check,ChevronLeft,ChevronRight,Package,ArrowLeft} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {speciesName} from "@/i18n/pokemon";
import {Modal} from "@/components/ui";
import {ChoiceGroup} from "@/components/choice-group";
import {spriteCopy,formatBytes,packLabel,spriteError} from "./sprites/copy";
import type {LibrarySnapshot,SpeciesRow,VariantRow} from "./sprites/service";
type Pack=LibrarySnapshot["packs"][number];
const normalize=(s:string)=>s.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
async function request(url:string,signal?:AbortSignal){const response=await fetch(url,{cache:"no-store",signal});const data=await response.json();if(!response.ok)throw Error(data.error||"request_failed");return data;}
export function SpriteLibrarySettings(){
 const {locale}=useI18n(),t=spriteCopy[locale];
 const [status,setStatus]=useState<LibrarySnapshot|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[filter,setFilter]=useState("all"),[query,setQuery]=useState(""),[view,setView]=useState<string|null>(null);
 const [confirm,setConfirm]=useState<{action:string;pack:string}|null>(null);
 useEffect(()=>{const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let active=true;
  const refresh=async()=>{try{const value=await request("/api/local/sprites",controller.signal);if(active){setStatus(value);}}catch(e){if(active&&!controller.signal.aborted)setError((e as Error).message);}finally{if(active)timer=setTimeout(()=>void refresh(),2500);}};
  void refresh();return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[]);
 async function action(action:string,pack="all",confirmed=false){setBusy(true);setError("");try{
  const response=await fetch("/api/local/sprites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,pack,confirm:confirmed})}),data=await response.json();if(!response.ok)throw Error(data.error||"request_failed");setStatus(data);setConfirm(null);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const blocked=busy||!status||status.maintenance||status.scan.state==="scanning";
 const packs=(status?.packs??[]).filter(p=>(filter==="all"||p.kind===filter)&&normalize(packLabel(p.id,p.label,locale)).includes(normalize(query)));
 const target=status?.packs.find(p=>p.id===confirm?.pack),label=(pack:Pack)=>packLabel(pack.id,pack.label,locale);
 const running=status?.jobs.some(j=>j.state==="downloading"||j.state==="queued");
 return <section className="local-settings-panel sprite-manager" id="sprite-library">
  <div className="local-settings-panel-head"><HardDrive size={20}/><div><h2>{t.title}</h2><p>{t.intro}</p></div></div>
  <div className="sprite-manager-body">
   <div className="sprite-storage-stats"><div><small>{t.occupied}</small><strong>{formatBytes(status?status.occupiedBytes+status.looseBytes+status.partialBytes:null,locale)}</strong></div><div><small>{t.free}</small><strong>{formatBytes(status?.freeBytes??null,locale)}</strong></div><div><small>{t.download}</small><strong>{formatBytes(status?.downloadBytes??null,locale)}</strong></div></div>
   {status&&status.scan.state!=="done"&&<p className="sprite-status" role="status">{t.scanning} {status.scan.done.toLocaleString(locale)} / {status.scan.total.toLocaleString(locale)}</p>}
   {error&&<p className="form-error" role="alert">{spriteError(error,t)}</p>}
   <div className="sprite-manager-toolbar"><ChoiceGroup label={t.all} value={filter} onChange={setFilter} options={[{value:"all",label:t.all},{value:"generation",label:t.generation},{value:"style",label:t.style},{value:"resources",label:t.resources}]}/><label className="app-search"><Search size={15}/><input type="search" value={query} placeholder={t.search} aria-label={t.search} onChange={e=>setQuery(e.target.value)}/></label></div>
   <div className="sprite-pack-grid">{packs.map(pack=>{
    const job=pack.job,active=job?.state==="downloading"||job?.state==="queued",paused=job?.state==="paused"||job?.state==="error",state=active?job!.state:paused?job!.state:pack.state;
    return <article className="sprite-pack" key={pack.id}>
     <div className="sprite-pack-title"><span className="sprite-pack-icon"><Package size={18}/></span><h3>{label(pack)}</h3><span className="sprite-pack-state" data-state={state}>{t[state as keyof typeof t]||state}</span></div>
     {pack.kind!=="resources"&&<p className="sprite-pack-coverage">{pack.compatible.toLocaleString(locale)} / {pack.speciesTotal.toLocaleString(locale)} {t.reference}<small>{pack.localSpecies.toLocaleString(locale)} {t.local.toLowerCase()}</small></p>}
     <dl className="sprite-pack-sizes"><div><dt>{t.download}</dt><dd>{formatBytes(pack.downloadBytes,locale)}</dd></div><div><dt>{t.occupied}</dt><dd>{formatBytes(pack.occupiedBytes,locale)}</dd></div><div><dt>{t.reclaim}</dt><dd>{formatBytes(pack.reclaimableBytes,locale)}</dd></div></dl>
     <p className="sprite-file-count">{pack.localFiles.toLocaleString(locale)} / {pack.files.toLocaleString(locale)} {t.files}</p>
     {job&&active&&<progress aria-label={label(pack)} max={job.total||1} value={job.done}/>}
     {job?.error&&!active&&<p className="form-error">{spriteError(job.error,t)}</p>}
     <div className="sprite-pack-actions">{active?<><button className="button secondary compact" disabled={busy} onClick={()=>void action("pause",pack.id)}><Pause size={14}/>{t.pause}</button><button className="text-link" disabled={busy} onClick={()=>void action("cancel",pack.id)}>{t.cancel}</button></>:pack.downloadBytes>0?<button className="button secondary compact" disabled={blocked} onClick={()=>void action(paused?"resume":"start",pack.id)}><Download size={14}/>{paused?t.resume:pack.state==="update"?t.update:t.install}</button>:<span className="sprite-status-complete"><Check size={14}/>{t.installed}</span>}
      <button className="button secondary compact" onClick={()=>setView(pack.id)}>{pack.kind==="resources"?t.files:t.compatibility}</button>
      <button className="icon-button" title={t.repair} aria-label={t.repair+" · "+label(pack)} disabled={blocked||running} onClick={()=>void action("repair",pack.id)}><RefreshCw size={14}/></button>
      <button className="icon-button sprite-pack-remove" title={t.remove} aria-label={t.remove+" · "+label(pack)} disabled={blocked||!pack.occupiedBytes&&!paused} onClick={()=>setConfirm({action:"remove",pack:pack.id})}><Trash2 size={14}/></button>
     </div>
    </article>;
   })}</div>
   {!packs.length&&<p className="app-no-results">{status?t.noResults:t.loading}</p>}
   <div className="sprite-manager-footer"><div><button className="button secondary compact" disabled={blocked} onClick={()=>setConfirm({action:"start",pack:"all"})}><Download size={15}/>{t.installAll}</button>{running&&<button className="button secondary compact" disabled={busy} onClick={()=>void action("pause")}><Pause size={15}/>{t.pause}</button>}</div><div><button className="text-link" disabled={blocked||running} onClick={()=>void action("verify")}>{t.verify}</button><button className="text-link" disabled={blocked||running} onClick={()=>void action("refresh")}>{t.refresh}</button><button className="text-link danger" disabled={blocked||!status?.occupiedBytes&&!status?.looseBytes&&!status?.partialBytes} onClick={()=>setConfirm({action:"remove",pack:"all"})}>{t.removeAll}</button></div></div>
   <p className="sprite-source-note">PokéAPI · {t.catalog} {status?.commit.slice(0,8)||"—"}{(status?.looseBytes??0)>0&&<> · {t.old}: {formatBytes(status!.looseBytes,locale)}</>}{(status?.partialBytes??0)>0&&<> · {t.parts}: {formatBytes(status!.partialBytes,locale)}</>}</p>
  </div>
  <Compatibility key={view} pack={view} label={view?label(status!.packs.find(p=>p.id===view)!):""} resources={status?.packs.find(p=>p.id===view)?.kind==="resources"} onClose={()=>setView(null)}/>
  <Modal open={!!confirm} onOpenChange={open=>{if(!open&&!busy)setConfirm(null);}} title={confirm?.action==="start"?t.confirmInstall:confirm?.pack==="all"?t.confirmAll:t.confirmRemove} description={confirm?.action==="start"?t.optional:confirm?.pack==="all"?t.kept:t.shared}>
   {target&&<h3>{label(target)}</h3>}<p className="sprite-confirm-size">{confirm?.action==="start"?t.download:t.reclaim}: <strong>{formatBytes(confirm?.action==="start"?status?.downloadBytes??null:target?.reclaimableBytes??(status?status.occupiedBytes+status.looseBytes+status.partialBytes:null),locale)}</strong></p>
   {error&&<p role="alert" className="form-error">{spriteError(error,t)}</p>}
   <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setConfirm(null)}>{t.cancel}</button><button className="button primary" disabled={busy} onClick={()=>confirm&&void action(confirm.action,confirm.pack,true)}>{busy?t.loading:confirm?.action==="start"?t.install:t.remove}</button></div>
  </Modal>
 </section>;
}
function Compatibility({pack,label,resources,onClose}:{pack:string|null;label:string;resources?:boolean;onClose:()=>void}){
 const {locale}=useI18n(),t=spriteCopy[locale];
 const [rows,setRows]=useState<SpeciesRow[]|null>(null),[variants,setVariants]=useState<VariantRow[]|null>(null),[focused,setFocused]=useState<number|null>(resources?0:null),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[sort,setSort]=useState("number"),[page,setPage]=useState(0),[error,setError]=useState("");
 useEffect(()=>{if(!pack)return;const controller=new AbortController();void request("/api/local/sprites?view=species&pack="+pack,controller.signal).then(d=>setRows(d.species)).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[pack]);
 useEffect(()=>{if(!pack||focused===null)return;const controller=new AbortController();void request("/api/local/sprites?view=variants&pack="+pack+"&species="+focused,controller.signal).then(d=>setVariants(d.variants)).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[pack,focused]);
 const filtered=useMemo(()=>[...(rows??[])].filter(row=>(normalize(speciesName(row.id,locale)).includes(normalize(query))||String(row.id).includes(query))&&(filter==="all"||filter==="compatible"&&row.compatible||filter==="local"&&row.local>0||filter==="unavailable"&&!row.compatible)).sort((a,b)=>sort==="name"?speciesName(a.id,locale).localeCompare(speciesName(b.id,locale),locale):a.id-b.id),[rows,locale,query,filter,sort]);
 const variantsFiltered=useMemo(()=>variants?.filter(v=>normalize(v.formName+" "+v.source+" "+v.path).includes(normalize(query)))??[],[variants,query]);
 const total=focused===null?filtered.length:variantsFiltered.length,pages=Math.max(1,Math.ceil(total/48)),current=Math.min(page,pages-1);
 return <Modal open={!!pack} onOpenChange={open=>{if(!open)onClose();}} title={label} description={focused===null?t.compatibility:t.variants} wide>
  <div className="sprite-compatibility">
   {focused!==null&&!resources&&<button className="text-link" onClick={()=>{setFocused(null);setVariants(null);setPage(0);setQuery("");}}><ArrowLeft size={15}/>{t.back} · {t.allSpecies}</button>}
   <div className="sprite-manager-toolbar"><label className="app-search"><Search size={15}/><input type="search" value={query} placeholder={t.search} aria-label={t.search} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>{focused===null&&<ChoiceGroup label={t.number} value={sort} onChange={v=>{setSort(v);setPage(0);}} options={[{value:"number",label:t.number},{value:"name",label:t.name}]}/>}</div>
   {focused===null&&<ChoiceGroup label={t.compatibility} value={filter} onChange={v=>{setFilter(v);setPage(0);}} options={[{value:"all",label:t.allSpecies},{value:"compatible",label:t.compatible},{value:"local",label:t.local},{value:"unavailable",label:t.unavailable}]}/>}
   {error&&<p className="form-error" role="alert">{spriteError(error,t)}</p>}
   <div className="sprite-compat-grid">{focused===null?filtered.slice(current*48,current*48+48).map(row=><button type="button" key={row.id} className="sprite-species" data-compatible={row.compatible} disabled={!row.compatible} onClick={()=>{setFocused(row.id);setVariants(null);setPage(0);setQuery("");}}><small>#{String(row.id).padStart(3,"0")}</small>{row.thumbnail?<img src={row.thumbnail} alt="" loading="lazy" width={70} height={70}/>:<span className="sprite-image-placeholder"><Package size={23}/></span>}<strong>{speciesName(row.id,locale)}</strong><span>{row.compatible?row.local?t.local:t.missing:t.unavailable}</span>{row.compatible&&<small>{row.forms} {t.forms} · {row.local} / {row.total} {t.files}</small>}</button>):
   variantsFiltered.slice(current*48,current*48+48).map(v=><article className="sprite-variant" key={v.path}>{v.url?<img src={v.url} width={88} height={88} loading="lazy" alt=""/>:<span className="sprite-image-placeholder"><Package size={25}/></span>}<strong>{v.formName}</strong><span>{v.source}</span><small>{[v.shiny?t.shiny:t.normal,v.back?t.back:t.front,v.female?t.female:"",v.animated?t.animated:""].filter(Boolean).join(" · ")}</small><span className="sprite-pack-state" data-state={v.installed?"installed":"absent"}>{v.included?t.included:v.installed?t.local:t.missing}</span><small>{formatBytes(v.bytes,locale)}</small><details><summary>{t.files}</summary><code>{v.path}</code></details></article>)}</div>
   {!(focused===null?rows:variants)?<p role="status">{t.loading}</p>:!total&&<p>{t.noResults}</p>}
   <div className="sprite-pagination"><span>{total.toLocaleString(locale)} · {current+1} / {pages}</span><button className="button secondary compact" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={15}/>{t.previous}</button><button className="button secondary compact" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>{t.next}<ChevronRight size={15}/></button></div>
  </div>
 </Modal>;
}
