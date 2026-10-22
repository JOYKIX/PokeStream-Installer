"use client";
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from "react";
import {Cable,Check,Link2,LoaderCircle,Monitor,Search,Settings2,Unlink} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {Modal,Toggle} from "@/components/ui";
import {Select,SelectOption} from "@/components/select";
import {external,type BuilderElement} from "./schema";
import type {LiveBox} from "@/local/builder-live";
type Scene={uuid:string;name:string};
type Source={id:number;uuid:string;name:string;enabled:boolean;group:boolean};
type Binding={id:string;elementId:string;overlayId:string;sceneName:string;sourceName:string;collection:string;error:string;active:boolean};
type State={status:"connecting"|"connected"|"disconnected";error:string;port:number;hasPassword:boolean;collection:string;realtime:boolean;bindings:Binding[]};
type Bridge={call:(action:string,value?:unknown)=>Promise<unknown>;subscribe:(callback:()=>void)=>()=>void};
const noSubscribe=()=>()=>{};
const bridge=()=>typeof window==="undefined"?null:(window as Window&{pokeStream?:{obs?:Bridge}}).pokeStream?.obs??null;
const box=(e:BuilderElement):LiveBox=>({id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,visible:e.visible,zIndex:e.zIndex});
const messages:Record<string,string>={obs_source_not_ready:"Cette capture n’est pas prête. Vérifie-la dans OBS, puis réessaie.",obs_overlay_disabled:"Active la diffusion de cet overlay avant de créer la scène OBS.",obs_scene_name_used:"Ce nom de scène existe déjà dans OBS. Choisis un autre nom.",obs_browser_unavailable:"La source navigateur n’est pas disponible dans OBS.",obs_cleanup_required:"Une scène créée a été modifiée dans OBS. Vérifie-la avant de réessayer.",obs_connection_failed:"Impossible de joindre OBS. Vérifie le serveur WebSocket.",obs_disconnected:"OBS est déconnecté.",obs_auth_failed:"Le mot de passe OBS est incorrect.",obs_password_unavailable:"Le mot de passe OBS ne peut pas être déchiffré sur ce PC.",obs_request_timeout:"OBS ne répond pas. Réessaie.",obs_request_failed:"OBS n’a pas pu appliquer cette action.",obs_profile_required:"Choisis un profil local pour relier OBS.",obs_layer_outside_canvas:"Place le calque dans le canevas avant de le relier.",obs_source_already_linked:"Cette source est déjà reliée à un calque.",obs_already_linked:"Ce calque est déjà relié à OBS.",obs_source_missing:"Cette source OBS est introuvable.",obs_scene_missing:"Cette scène OBS est introuvable.",obs_collection_mismatch:"Ouvre la collection OBS utilisée par cette liaison.",obs_original_missing:"La source originale a été supprimée dans OBS.",obs_container_modified:"Le conteneur contient d’autres sources. Conserve-les avant de délier.",obs_operation_busy:"Une action OBS est déjà en cours.",obs_overlay_missing:"Enregistre l’overlay avant de le relier.",obs_invalid_layer:"Enregistre ce calque avant de le relier.",obs_invalid_port:"Indique un port OBS valide."};
function errorMessage(error:unknown){const text=error instanceof Error?error.message:String(error),code=text.match(/obs_[a-z_]+/)?.[0];return messages[code??""]??"Connexion OBS indisponible.";}
export function useOBSIntegration(overlayId:string,elements:BuilderElement[],version:number){
 const api=useSyncExternalStore(noSubscribe,bridge,()=>null);
 const [state,setState]=useState<State|null>(null),[error,setError]=useState("");
 const transport=useRef({session:"",epoch:0,sequence:0,busy:false,timer:undefined as ReturnType<typeof setTimeout>|undefined,pending:null as {elements:LiveBox[];version:number;boundIds:string[]}|null});
 const refresh=useCallback(async()=>{const native=bridge();if(!native)return;try{setState(await native.call("state",{overlayId}) as State);}catch(e){setError(errorMessage(e));}},[overlayId]);
 useEffect(()=>{const native=bridge();if(!native)return;const unsubscribe=native.subscribe(()=>void refresh());queueMicrotask(()=>void refresh());return unsubscribe;},[refresh]);
 const applySaved=useCallback(async()=>{const native=bridge();if(!native)return;try{if(await native.call("apply",{overlayId}))setError("");}catch(e){setError(errorMessage(e));}},[overlayId]);
 const realtime=state?.realtime??false;
 const perform=useCallback(async<T,>(action:string,value:Record<string,unknown>={})=>{const native=bridge();if(!native)throw Error("obs_desktop_required");setError("");try{const result=await native.call(action,{...value,overlayId}) as T;await refresh();return result;}catch(e){setError(errorMessage(e));throw e;}},[overlayId,refresh]);
 useEffect(()=>{const q={session:crypto.randomUUID(),epoch:0,sequence:0,busy:false,timer:undefined as ReturnType<typeof setTimeout>|undefined,pending:null as {elements:LiveBox[];version:number;boundIds:string[]}|null};transport.current=q;return()=>{q.epoch++;q.pending=null;clearTimeout(q.timer);q.timer=undefined;void fetch("/api/builder/"+overlayId+"/live",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset:true,session:q.session}),keepalive:true}).catch(()=>{});if(realtime)void bridge()?.call("revert",{overlayId,session:q.session}).catch(()=>{});};},[overlayId,realtime]);
 const signature=JSON.stringify(elements.filter(external).map(box)),boundIds=JSON.stringify(state?.bindings.map(b=>b.elementId)??[]);
 const liveSignature=realtime?signature:"";
 useEffect(()=>{
  if(!api||state?.status!=="connected"||boundIds==="[]")return;
  if(!realtime){let cancelled=false;queueMicrotask(()=>{if(!cancelled)void applySaved();});return()=>{cancelled=true;};}
  const q=transport.current;q.pending={elements:JSON.parse(liveSignature) as LiveBox[],version,boundIds:JSON.parse(boundIds) as string[]};
  const flush=async()=>{q.timer=undefined;if(q.busy)return;q.busy=true;const epoch=q.epoch;try{while(q.pending&&q.epoch===epoch){const next=q.pending;q.pending=null;const sequence=++q.sequence;const response=await fetch("/api/builder/"+overlayId+"/live",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset:false,session:q.session,sequence,...next})});if(q.epoch!==epoch)break;if(response.status===409)continue;if(!response.ok)throw Error("obs_overlay_missing");await api.call("sync",{overlayId,session:q.session,sequence,elements:next.elements});}}catch(e){setError(errorMessage(e));}finally{q.busy=false;}};
  if(!q.busy&&!q.timer)q.timer=setTimeout(()=>void flush(),16);
 },[api,overlayId,realtime,liveSignature,boundIds,version,state?.status,state?.collection,applySaved]);
 return {supported:!!api,state,error,setError,perform,refresh,applySaved};
}
export type OBSIntegration=ReturnType<typeof useOBSIntegration>;
export function OBSIntegrationPanel({obs,element,onBeforeLink}:{obs:OBSIntegration;element?:BuilderElement;onBeforeLink:()=>Promise<boolean>}){
 const {t}=useI18n(),[pendingRealtime,setPendingRealtime]=useState<boolean|null>(null),[config,setConfig]=useState(false),[link,setLink]=useState(false),[busy,setBusy]=useState(false),[port,setPort]=useState(4455),[password,setPassword]=useState(""),[scenes,setScenes]=useState<Scene[]>([]),[scene,setScene]=useState<Scene|null>(null),[sources,setSources]=useState<Source[]>([]),[selected,setSelected]=useState<number|null>(null),[search,setSearch]=useState("");
 const binding=obs.state?.bindings.find(b=>b.elementId===element?.id),connected=obs.state?.status==="connected";
 async function run(task:()=>Promise<void>){setBusy(true);try{await task();}catch{/* The hook exposes the localized action error. */}finally{setBusy(false);}}
 async function chooseScene(next:Scene){setScene(next);setSelected(null);setSources([]);await run(async()=>setSources(await obs.perform<Source[]>("sources",{scene:next})));}
 async function openLink(){if(!element)return;await run(async()=>{if(!await onBeforeLink())return;const result=await obs.perform<Scene[]>("scenes");setScenes(result);setSources([]);setScene(null);setSelected(null);setSearch("");setLink(true);if(result[0]){setScene(result[0]);setSources(await obs.perform<Source[]>("sources",{scene:result[0]}));}});}
 async function removeBinding(id:string){await run(async()=>{await obs.perform("unlink",{bindingId:id});});}
 return <section className="obs-integration-panel" aria-label={t("Liaison OBS")}>
  <div className="obs-connection-heading"><span><Cable size={16}/><strong>OBS Studio</strong></span><span className={"obs-connection-state "+(connected?"connected":"")}>{t(connected?"Connecté":obs.state?.status==="connecting"?"Connexion…":"Déconnecté")}</span></div>
  {!obs.supported?<p className="builder-note">{t("La liaison OBS est disponible dans l’application Windows.")}</p>:<>
   <button type="button" className="button secondary compact obs-configure" disabled={busy} onClick={()=>{setPort(obs.state?.port??4455);setPassword("");setConfig(true);}}><Settings2 size={14}/>{t(connected?"Configurer la connexion OBS":"Connecter OBS")}</button>
   {element&&external(element)&&(binding?<div className="obs-binding-card"><div><Link2 size={15}/><strong>{binding.sourceName}</strong></div><small>{binding.sceneName}</small><p>{t(binding.error?messages[binding.error]??"Connexion OBS indisponible.":!binding.active?"Ouvre la collection OBS utilisée par cette liaison.":obs.state?.realtime?"Position et taille synchronisées.":"Actualisé à l’enregistrement.")}</p><button className="button secondary compact" disabled={busy||!connected||binding.collection!==obs.state?.collection} onClick={()=>void removeBinding(binding.id)}><Unlink size={14}/>{t("Délier la source")}</button></div>:<button type="button" className="button primary compact obs-link-button" disabled={!connected||busy} onClick={()=>void openLink()}><Link2 size={15}/>{t("Relier une source OBS")}</button>)}
   {!element&&!!obs.state?.bindings.length&&<div className="obs-binding-list" aria-label={t("Liaisons OBS")}>{obs.state.bindings.map(b=><div key={b.id}><span><strong>{b.sourceName}</strong><small>{b.sceneName}</small></span><button type="button" className="icon-button" aria-label={t("Délier la source")+" · "+b.sourceName} title={t("Délier la source")} disabled={busy||!connected||b.collection!==obs.state?.collection} onClick={()=>void removeBinding(b.id)}><Unlink size={15}/></button></div>)}</div>}
   <Toggle label="Synchroniser les calques en temps réel" checked={pendingRealtime??obs.state?.realtime??false} disabled={busy||!obs.state} onChange={realtime=>{setPendingRealtime(realtime);void run(async()=>{try{await obs.perform("mode",{realtime});}finally{setPendingRealtime(null);}});}}/>
   <p className="builder-note">{t("Sinon, clique sur Enregistrer pour appliquer la disposition dans OBS.")}</p>
   {binding&&<p className="builder-note">{t("Délier restaure le placement initial de la source.")}</p>}
  </>}
  {(obs.error||obs.state?.error)&&<p className="obs-integration-error" role="alert">{t(obs.error||messages[obs.state?.error??""]||"Connexion OBS indisponible.")}</p>}
  <Modal open={config} onOpenChange={open=>{if(!busy)setConfig(open);}} title={t("Connexion à OBS")} description={t("Dans OBS : Outils → Paramètres du serveur WebSocket.")} className="obs-connection-modal">
   <form onSubmit={event=>{event.preventDefault();void run(async()=>{await obs.perform("connect",{port,...(password||!obs.state?.hasPassword?{password}:{})});setConfig(false);setPassword("");});}}>
    <label className="field"><span>{t("Port WebSocket")}</span><input type="number" min={1} max={65535} value={port} onChange={event=>setPort(Number(event.target.value))} required/></label>
    <label className="field"><span>{t("Mot de passe OBS")}</span><input type="password" autoComplete="off" maxLength={1024} value={password} placeholder={obs.state?.hasPassword?t("Mot de passe enregistré"):""} onChange={event=>setPassword(event.target.value)}/></label>
    <p className="builder-note">{t(obs.state?.hasPassword?"Laisse vide pour conserver le mot de passe enregistré.":"Le mot de passe est chiffré et conservé sur ce PC.")}</p>
    {obs.error&&<p className="obs-integration-error" role="alert">{t(obs.error)}</p>}
    <div className="modal-actions">{connected&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void run(async()=>{await obs.perform("disconnect");setConfig(false);})}>{t("Déconnecter")}</button>}<button className="button primary" disabled={busy||obs.state?.status==="connecting"}>{busy?<LoaderCircle size={16} className="spin"/>:<Cable size={16}/>} {t("Connecter")}</button></div>
   </form>
  </Modal>
  <Modal open={link} onOpenChange={open=>{if(!busy)setLink(open);}} title={t("Relier une source OBS")} description={t("Le cadrage de la capture est conservé.")} className="obs-source-modal" wide>
   <div className="obs-source-controls"><label className="field"><span>{t("Scène OBS")}</span><Select value={scene?.uuid||scene?.name||"none"} onValueChange={value=>{const next=scenes.find(s=>(s.uuid||s.name)===value);if(next)void chooseScene(next);}} disabled={busy}><SelectOption value="none">{t("Choisir une scène OBS")}</SelectOption>{scenes.map(s=><SelectOption key={s.uuid||s.name} value={s.uuid||s.name}>{s.name}</SelectOption>)}</Select></label><label className="search-field"><Search size={16}/><input type="search" value={search} placeholder={t("Rechercher une source…")} onChange={event=>setSearch(event.target.value)}/></label></div>
   <div className="obs-source-list" role="group" aria-label={t("Sources OBS")}>{sources.filter(s=>s.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(source=><button key={source.id} type="button" className={selected===source.id?"selected":""} aria-pressed={selected===source.id} disabled={busy} onClick={()=>setSelected(source.id)}><span className="obs-source-symbol"><Monitor size={20}/></span><span><strong>{source.name}</strong><small>{t(source.group?"Groupe OBS":"Source OBS")}</small></span>{selected===source.id&&<Check size={18}/>}</button>)}{!sources.length&&<p className="builder-note">{t(busy?"Chargement…":"Aucune source dans cette scène.")}</p>}</div>
   <p className="builder-note">{t("Cadre d’abord la source dans OBS à l’emplacement du calque.")} {t("Pour ajuster le cadrage ensuite, ouvre la scène PokeStream créée dans OBS.")}</p>
   {obs.error&&<p className="obs-integration-error" role="alert">{t(obs.error)}</p>}
   <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setLink(false)}>{t("Annuler")}</button><button type="button" className="button primary" disabled={busy||selected===null||!scene||!element} onClick={()=>void run(async()=>{if(!element||!scene||selected===null)return;await obs.perform("bind",{elementId:element.id,scene,itemId:selected,box:box(element)});setLink(false);})}>{busy?<LoaderCircle size={16} className="spin"/>:<Link2 size={16}/>} {t("Relier")}</button></div>
  </Modal>
 </section>;
}
