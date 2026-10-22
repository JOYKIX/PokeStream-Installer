"use client";
import {useI18n} from "@/i18n/client";
import {useEffect,useState} from "react";
import {Check,Copy,Download,LoaderCircle,Share2,Monitor,Users} from "lucide-react";
import {Select,SelectOption} from "./select";
import {Modal} from "./ui";

type LocalProfile={id:string;name:string;color:string};
export function ShareCreation({kind,sourceId,name,disabled=false,compact=false}: {
 kind:"theme"|"overlay"|"profile";sourceId:string;version:number;name:string;disabled?:boolean;compact?:boolean;
}) {
 const {t}=useI18n();
 const [open,setOpen]=useState(false),[users,setUsers]=useState<LocalProfile[]>([]),[recipient,setRecipient]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const resource=kind==="profile"?"scene":kind==="overlay"?"builder":"theme";
 useEffect(()=>{if(!open)return;fetch("/api/local/shares",{cache:"no-store"}).then(r=>r.json()).then(data=>setUsers(data.users||[])).catch(()=>setError("Impossible de charger les profils locaux."));},[open]);
 async function download(){setBusy(true);setError("");setMessage("");try{
  const r=await fetch(`/api/local/shares?kind=${resource}&id=${sourceId}&format=pokestream`);
  if(!r.ok){const p=await r.json().catch(()=>({}));throw Error(p.error||"Export impossible.");}
  const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download=`PokeStream-${resource}-${sourceId}.pokestream`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);setMessage("Fichier prêt à partager !");
 }catch(e){setError(e instanceof Error?e.message:"Export impossible.");}finally{setBusy(false);}}
 async function copy(){if(!recipient)return;setBusy(true);setError("");setMessage("");try{
  const r=await fetch("/api/local/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"copy",kind:resource,id:sourceId,targetUserId:recipient})});
  const p=await r.json();if(!r.ok)throw Error(p.error||"Copie impossible.");setMessage("Copie indépendante ajoutée au profil destinataire.");
 }catch(e){setError(e instanceof Error?e.message:"Copie impossible.");}finally{setBusy(false);}}
 return <><button type="button" className={compact?"icon-button":undefined} disabled={disabled} title={t("Partager")} aria-label={t("Partager {name}",{name})} onClick={()=>{setOpen(true);setMessage("");setError("");}}><Share2 size={16}/>{!compact&&t("Partager")}</button>
 <Modal open={open} onOpenChange={setOpen} title={t("Partager {name}",{name})} description={t("Choisis comment partager cette création.")}>
  <div className="share-form"><section className="share-method"><h3><Monitor size={17}/>{t("Partager avec un autre PC")}</h3><p>{t("Exporte un fichier .pokestream contenant la création et ses ressources associées.")}</p>
   <button className="button primary" type="button" disabled={busy} onClick={()=>void download()}>{busy?<LoaderCircle size={16}/>:<Download size={16}/>}{t("Exporter le fichier")}</button>
  </section><section className="share-method"><h3><Users size={17}/>{t("Copier dans un autre profil local")}</h3><Select aria-label={t("Profil destinataire")} value={recipient||"none"} onValueChange={value=>setRecipient(value==="none"?"":value)} disabled={busy}><SelectOption value="none">{t("Sélectionner un profil…")}</SelectOption>{users.map(u=><SelectOption value={u.id} key={u.id}>{u.name}</SelectOption>)}</Select>{!users.length&&<p>{t("Ajoute un autre profil local pour y copier une création.")}</p>}
   <button className="button secondary" type="button" disabled={busy||!recipient} onClick={()=>void copy()}><Copy size={16}/>{t("Copier vers ce profil")}</button></section>
   {error&&<p className="form-error" role="alert">{t(error)}</p>}{message&&<p className="share-success" role="status"><Check size={16}/> {t(message)}</p>}
   <div className="modal-actions"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>{t("Fermer")}</button></div>
  </div>
 </Modal></>;
}
