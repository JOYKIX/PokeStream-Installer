"use client";
import {useEffect,useRef,useState} from "react";
import sources from "@/data/sprite-sources.json";
import {useI18n} from "@/i18n/client";
import {Modal,Toggle} from "@/components/ui";
import {Download,Package} from "lucide-react";
import {spriteCopy,packLabel,formatBytes,spriteError} from "./sprites/copy";
import type {LibrarySnapshot} from "./sprites/service";
export function packForStyle(style:string){
 const source=sources.find(s=>s.id===style);if(!source)return null;
 const roman=["i","ii","iii","iv","v","vi","vii","viii","ix"],generation=/generation-([^/]+)\//.exec(source.path)?.[1];
 if(generation&&roman.includes(generation))return "gen-"+(roman.indexOf(generation)+1);
 if(source.path.startsWith("other/official-artwork"))return "artwork";
 if(source.path.startsWith("other/dream-world"))return "dream-world";
 if(source.path.startsWith("other/home"))return "home";
 if(source.path.startsWith("other/showdown"))return "showdown";
 return "default";
}
type Pending={pack:string;apply:()=>void;storageKey:string};
export function useSpritePackPrompt(enabled:boolean){
 const {locale}=useI18n(),t=spriteCopy[locale];
 const [pending,setPending]=useState<Pending|null>(null),[status,setStatus]=useState<LibrarySnapshot|null>(null),[dontAsk,setDontAsk]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const generation=useRef(0);
 useEffect(()=>{if(!pending)return;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let active=true;
  const refresh=async()=>{try{const r=await fetch("/api/local/sprites",{cache:"no-store",signal:controller.signal});if(!r.ok)throw Error();const data:LibrarySnapshot=await r.json();if(active){setStatus(data);if(data.scan.state==="scanning")timer=setTimeout(()=>void refresh(),1000);}}catch{if(active)setError(t.failure);}};
  void refresh();return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[pending,t.failure]);
 async function choose(style:string|undefined,apply:()=>void){
  const pack=style&&packForStyle(style);if(!enabled||!pack){apply();return;}
  const token=++generation.current;
  try{
   const response=await fetch("/api/local/users",{cache:"no-store"});if(!response.ok)throw Error();
   const user=await response.json(),storageKey="pokestream:hide-sprite-pack-prompt:"+user.active;
   if(localStorage.getItem(storageKey)==="1"){if(token===generation.current)apply();return;}
   const request=await fetch("/api/local/sprites",{cache:"no-store"});if(!request.ok)throw Error();
   const data:LibrarySnapshot=await request.json(),item=data.packs.find(p=>p.id===pack);
   if(token!==generation.current)return;
   if(!item||item.downloadBytes===0||item.job&&["queued","downloading"].includes(item.job.state)){apply();return;}
   setStatus(data);setDontAsk(false);setError("");setPending({pack,apply,storageKey});
  }catch{if(token===generation.current)apply();}
 }
 function remember(){if(pending&&dontAsk)try{localStorage.setItem(pending.storageKey,"1");}catch{}}
 async function install(){
  if(!pending)return;setBusy(true);setError("");
  try{const response=await fetch("/api/local/sprites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start",pack:pending.pack})}),data=await response.json();if(!response.ok)throw Error(data.error);remember();pending.apply();setPending(null);}catch(e){setError(spriteError((e as Error).message,t));}finally{setBusy(false);}
 }
 const pack=status?.packs.find(p=>p.id===pending?.pack);
 return {choose,dialog:<Modal open={!!pending} onOpenChange={open=>{if(!open&&!busy){remember();setPending(null);}}} title={t.promptTitle} description={t.prompt}>
  {pack&&<div className="sprite-theme-pack"><Package size={23}/><div><strong>{packLabel(pack.id,pack.label,locale)}</strong><small>{t.download}: {formatBytes(pack.downloadBytes,locale)}</small></div></div>}
  <p className="sprite-prompt-note">{t.promptNote}</p>
  <Toggle label={t.dontAsk} checked={dontAsk} onChange={setDontAsk}/>
  {status?.scan.state==="scanning"&&<p role="status" className="sprite-prompt-note">{t.scanning}</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="sprite-prompt-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>{remember();setPending(null);}}>{t.cancel}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>{remember();pending?.apply();setPending(null);}}>{t.without}</button><button type="button" className="button primary" disabled={busy||status?.scan.state==="scanning"||!pack} onClick={()=>void install()}><Download size={15}/>{busy?t.loading:t.install}</button></div>
 </Modal>};
}
