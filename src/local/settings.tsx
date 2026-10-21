"use client";
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from "react";
import {ArrowDownToLine,ArrowUpFromLine,Copy,FolderOpen,HardDrive,Users,FileJson,CheckCircle2,AlertCircle,RefreshCw} from "lucide-react";

type Item={id:string;name:string};
type Profile={id:string;name:string;color:string};
type Library={scenes:Item[];themes:Item[];builders:Item[];users:Profile[]};
type Kind="scene"|"theme"|"builder";
const groups:{kind:Kind;title:string;key:keyof Pick<Library,"scenes"|"themes"|"builders">}[]=[
 {kind:"scene",title:"Aventures",key:"scenes"},{kind:"theme",title:"Thèmes",key:"themes"},{kind:"builder",title:"Compositions OBS",key:"builders"}];
type UpdatesBridge={check:()=>Promise<{status:string;version:string;current?:string}>;download:()=>Promise<{status:string;version?:string}>;install:()=>Promise<{status:string}>};
type DesktopBridge={openData:()=>Promise<void>;openLauncher?:()=>Promise<void>;updates?:UpdatesBridge};
function UpdateSettings(){
 const bridge=useSyncExternalStore<DesktopBridge|null>(()=>()=>{},()=>((window as Window&{pokeStream?:DesktopBridge}).pokeStream||null),()=>null);
 return <section className="local-settings-panel update-panel"><div className="local-settings-panel-head"><RefreshCw size={20}/><div><h2>Launcher PokeStream</h2><p>Installation, mises à jour et réparation.</p></div></div><div className="local-settings-action"><button className="button secondary" disabled={!bridge?.openLauncher} onClick={()=>void bridge?.openLauncher?.()}><RefreshCw size={16}/> Ouvrir le launcher</button><small>Tes profils et tes créations sont conservés lors des mises à jour.</small></div></section>;
}
export function LocalSettings(){
 const [data,setData]=useState<Library|null>(null);
 const [busy,setBusy]=useState(false);
 const [alert,setAlert]=useState<{error:boolean;text:string}|null>(null);
 const [selected,setSelected]=useState<{kind:Kind;id:string}|null>(null);
 const [recipient,setRecipient]=useState("");
 const [fileFormat,setFileFormat]=useState("pokestream");
 const file=useRef<HTMLInputElement>(null);
 const refresh=useCallback(async()=>{
  const r=await fetch("/api/local/shares",{cache:"no-store"});if(!r.ok)throw new Error("Impossible de charger les créations.");
  const result=await r.json() as Library;setData(result);
  setSelected(current=>current&&result[groups.find(g=>g.kind===current.kind)!.key].some(i=>i.id===current.id)?current:null);
 },[]);
 useEffect(()=>{let stopped=false;queueMicrotask(()=>{if(!stopped)refresh().catch(e=>{if(!stopped)setAlert({error:true,text:e.message});});});return ()=>{stopped=true;};},[refresh]);
 const item=selected&&data?.[groups.find(g=>g.kind===selected.kind)!.key].find(i=>i.id===selected.id);
 async function perform(task:()=>Promise<void>){setBusy(true);setAlert(null);try{await task();await refresh();}catch(error){setAlert({error:true,text:error instanceof Error?error.message:"Opération impossible."});}finally{setBusy(false);}}
 async function share(action:"copy",targetUserId:string){if(!selected)return;await perform(async()=>{
  const r=await fetch("/api/local/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,kind:selected.kind,id:selected.id,targetUserId})});
  const response=await r.json();if(!r.ok)throw new Error(response.error||"Copie impossible.");
  setAlert({error:false,text:"Copie créée dans l'autre profil. L'original reste inchangé."});
 });}
 async function download(){if(!selected)return;await perform(async()=>{
  const r=await fetch(`/api/local/shares?kind=${selected.kind}&id=${selected.id}&format=${fileFormat}`);
  if(!r.ok){const p=await r.json().catch(()=>({}));throw new Error(p.error||"Export impossible.");}
  const blob=await r.blob();const href=URL.createObjectURL(blob);
  const anchor=document.createElement("a");anchor.href=href;anchor.download=`PokeStream-${selected.kind}-${selected.id}.${fileFormat}`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(href),15000);
  setAlert({error:false,text:"Fichier exporté. Tu peux le partager avec un autre PC."});
 });}
 async function upload(f:File|null){if(!f)return;
  await perform(async()=>{
   if(!/\.(pokestream|json)$/i.test(f.name))throw new Error("Choisis un fichier .pokestream ou .json.");
   if(f.size>48*1024*1024)throw new Error("Fichier trop volumineux (48 Mo maximum).");
   const bundle=JSON.parse(await f.text());
   const r=await fetch("/api/local/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"import",bundle})});
   const response=await r.json();if(!r.ok)throw new Error(response.error||"Import impossible.");
   setAlert({error:false,text:`Import réussi : ${response.created.scenes} aventure(s), ${response.created.themes} thème(s), ${response.created.builders} composition(s).`});
  });if(file.current)file.current.value="";
 }
 function openData(){const bridge=(window as Window&{pokeStream?:{openData:()=>Promise<void>}}).pokeStream;if(bridge?.openData)void bridge.openData();else setAlert({error:true,text:"L'accès au dossier de données est disponible depuis l'application Windows."});}
 return <main className="site-container local-settings" id="main">
  <div className="local-settings-heading"><div><span className="section-label">POKESTREAM · LOCAL</span><h1>Partage et sauvegardes</h1><p>Tes créations appartiennent à ton profil et restent sur ton PC. Partage-les sans compte, sans serveur.</p></div><button className="button secondary" onClick={openData}><FolderOpen size={17}/> Ouvrir mes données</button></div>
  {alert&&<div className={`local-settings-alert ${alert.error?"error":"success"}`} role="status">{alert.error?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>}<span>{alert.text}</span></div>}
  <div className="local-share-grid"><section className="local-settings-panel"><div className="local-settings-panel-head"><FileJson size={20}/><div><h2>Mes créations</h2><p>Sélectionne un élément à exporter ou copier.</p></div><button className="icon-button" aria-label="Actualiser" title="Actualiser" onClick={()=>void refresh()}><RefreshCw size={17}/></button></div>
   {data?groups.map(g=><div className="local-settings-group" key={g.kind}><h3>{g.title} <span>{data[g.key].length}</span></h3><div className="local-settings-items">{data[g.key].length?data[g.key].map(i=><button type="button" key={i.id} className={`local-settings-item ${selected?.id===i.id&&selected.kind===g.kind?"active":""}`} aria-pressed={selected?.id===i.id&&selected.kind===g.kind} onClick={()=>setSelected({kind:g.kind,id:i.id})}>{i.name}</button>):<span className="local-settings-empty">Aucune création</span>}</div></div>):<p className="local-settings-empty">Chargement des créations…</p>}</section>
   <div className="local-settings-side"><section className="local-settings-panel"><div className="local-settings-panel-head"><ArrowDownToLine size={20}/><div><h2>Exporter une création</h2><p>Pour conserver ou transmettre ta création.</p></div></div><div className="local-settings-action"><strong>{item?.name||"Sélectionne une création"}</strong><label htmlFor="export-format">Format du fichier</label><select id="export-format" value={fileFormat} onChange={e=>setFileFormat(e.target.value)}><option value="pokestream">.pokestream — format PokeStream</option><option value="json">.json — format lisible</option></select><button className="button primary" disabled={!item||busy} onClick={()=>void download()}><ArrowDownToLine size={17}/> Exporter</button><small>Les thèmes associés et les images de composition sont intégrés automatiquement.</small></div></section>
    <section className="local-settings-panel"><div className="local-settings-panel-head"><Users size={20}/><div><h2>Copier vers un autre profil</h2><p>Une copie indépendante, sans modifier l&apos;original.</p></div></div><div className="local-settings-action"><label htmlFor="share-profile">Profil destinataire</label><select id="share-profile" value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Choisir un profil…</option>{data?.users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><button className="button secondary" disabled={!item||!recipient||busy} onClick={()=>void share("copy",recipient)}><Copy size={17}/> Copier dans ce profil</button></div></section>
    <UpdateSettings/>
    <section className="local-settings-panel"><div className="local-settings-panel-head"><ArrowUpFromLine size={20}/><div><h2>Importer un fichier</h2><p>Une création reçue d&apos;un autre utilisateur ou PC.</p></div></div><div className="local-settings-action"><input type="file" hidden ref={file} accept=".pokestream,.json,application/json" onChange={e=>void upload(e.target.files?.[0]||null)}/><button className="button secondary" disabled={busy} onClick={()=>file.current?.click()}><ArrowUpFromLine size={17}/> Choisir un fichier</button><small>L&apos;import crée toujours de nouveaux identifiants et de nouveaux liens OBS.</small></div></section></div></div>
  <p className="local-settings-footnote"><HardDrive size={15}/> Les données sont enregistrées localement. Pense à en conserver une sauvegarde sur un autre disque.</p>
 </main>;
}
