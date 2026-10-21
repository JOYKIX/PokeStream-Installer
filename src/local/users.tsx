"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {Plus,Pencil,Check,Trash2,ArrowRight,HardDrive,LoaderCircle} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {Modal,Confirm} from "@/components/ui";
import {UserAvatar} from "@/components/user-avatar";
type User={id:string;name:string;color:string;avatar:string};
const colors=["#b12c43","#335ba5","#387c6a","#8757a2","#b57835","#555e79"];
export function LocalUsers(){
 const {t}=useI18n(),router=useRouter();
 const [users,setUsers]=useState<User[]>([]),[active,setActive]=useState<string|null>(null),[loading,setLoading]=useState(true),[edit,setEdit]=useState<Partial<User>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[remove,setRemove]=useState<User|null>(null);
 const file=useRef<HTMLInputElement>(null);
 const reload=useCallback(async(signal?:AbortSignal)=>{const r=await fetch("/api/local/users",{cache:"no-store",signal});if(!r.ok)throw Error("request_failed");const data=await r.json();if(!signal?.aborted){setUsers(data.users);setActive(data.active??null);}},[]);
 useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)void reload(controller.signal).catch(()=>{if(!controller.signal.aborted)setError(t("Chargement impossible. Réessaie."));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});});return()=>controller.abort();},[reload,t]);
 function errorMessage(cause:unknown,fallback:string){const key=cause instanceof Error?cause.message:"";return t(key==="origin_refused"?"Requête locale refusée. Ferme puis relance PokeStream.":key==="profile_invalid"?"Vérifie le nom, la couleur et l’image du profil.":key==="storage_unavailable"?"Impossible d’enregistrer sur ce PC. Ouvre les logs depuis le launcher.":key==="profile_missing"?"Ce profil n’existe plus. Actualise la page.":fallback);}
 async function send(method:string,body:unknown){const r=await fetch("/api/local/users",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok){const result=await r.json().catch(()=>({}));throw Error(result.error||"request_failed");}}
 async function select(u:User){setBusy(true);setError("");try{await send("PATCH",{id:u.id,select:true});
 // A full document load clears the previous local user’s route and data caches.
 // eslint-disable-next-line @next/next/no-location-assign-relative-destination
 window.location.assign("/studio");}catch(cause){setError(errorMessage(cause,"Impossible d’ouvrir ce profil."));setBusy(false);}}
 async function save(event:React.FormEvent){event.preventDefault();if(!edit?.name?.trim())return;setBusy(true);setError("");try{const details={name:edit.name.trim(),color:edit.color||colors[0],avatar:edit.avatar||""};await send(edit.id?"PATCH":"POST",edit.id?{id:edit.id,details}:details);await reload();setEdit(null);router.refresh();}catch(cause){setError(errorMessage(cause,"Enregistrement impossible."));}finally{setBusy(false);}}
 async function changeAvatar(f?:File){if(!f)return;setError("");if(!f.type.startsWith("image/")||f.size>20*1024*1024){setError(t("Image trop volumineuse (20 Mo maximum)."));return;}setBusy(true);try{const bitmap=await createImageBitmap(f),canvas=document.createElement("canvas");canvas.width=canvas.height=192;const ctx=canvas.getContext("2d");if(!ctx)throw Error();const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,192,192);bitmap.close();setEdit(value=>({...value,avatar:canvas.toDataURL("image/png")}));}catch{setError(t("Image invalide."));}finally{setBusy(false);if(file.current)file.current.value="";}}
 function openEdit(value:Partial<User>){setError("");setEdit(value);}
 async function destroy(){if(!remove)return;setBusy(true);try{await send("DELETE",{id:remove.id,confirm:true});setRemove(null);await reload();router.refresh();}catch{setError(t("Suppression impossible."));}finally{setBusy(false);}}
 return <main className="profiles-page" id="main">
  <header className="profiles-heading"><div><h1>{t("Profils locaux")}</h1><p>{t("Choisis ton espace de travail.")}</p></div><span className="profiles-local-note"><HardDrive size={15}/>{t("Sur ce PC")}</span></header>
  {error&&!edit&&<p className="error-banner" role="alert">{error}</p>}
  {loading?<p className="muted" role="status">{t("Chargement…")}</p>:<div className="profile-picker-grid">{users.map(user=><article className="profile-picker-card" key={user.id} data-active={user.id===active}>
   {user.id===active&&<span className="profile-active-label">{t("Actif")}</span>}
   <button className="profile-picker-main" disabled={busy} onClick={()=>void select(user)}><UserAvatar name={user.name} src={user.avatar} color={user.color} size="large"/><strong>{user.name}</strong><small>{t("Ouvrir")}<ArrowRight size={13}/></small></button>
   <button className="icon-button profile-picker-edit" disabled={busy} title={t("Modifier le profil local")} aria-label={t("Modifier")+" · "+user.name} onClick={()=>openEdit(user)}><Pencil size={16}/></button>
  </article>)}
   <button className="profile-picker-add" disabled={busy} onClick={()=>openEdit({name:"",color:colors[users.length%colors.length],avatar:""})}><span><Plus size={27}/></span><strong>{t("Ajouter un profil")}</strong></button>
  </div>}
  <Modal open={!!edit} onOpenChange={value=>{if(!value&&!busy){setEdit(null);setError("");}}} title={t(edit?.id?"Modifier le profil local":"Nouveau profil local")}>
   <form className="local-user-form" onSubmit={save}><div className="profile-editor-avatar"><UserAvatar name={edit?.name} src={edit?.avatar} color={edit?.color} size="large"/><div><button type="button" className="button secondary compact" disabled={busy} onClick={()=>file.current?.click()}>{t("Choisir une image")}</button>{edit?.avatar&&<button type="button" className="text-link muted" disabled={busy} onClick={()=>setEdit(value=>({...value,avatar:""}))}>{t("Retirer l’image")}</button>}</div></div>
    <input hidden ref={file} type="file" accept="image/*" onChange={event=>void changeAvatar(event.target.files?.[0])}/>
    <label>{t("Nom")}<input autoFocus maxLength={32} required disabled={busy} value={edit?.name||""} onChange={event=>setEdit(value=>({...value,name:event.target.value}))}/></label>
    <div><span className="small muted">{t("Couleur")}</span><div className="profile-editor-colors" role="group" aria-label={t("Couleur")}>{colors.map(color=><button type="button" disabled={busy} key={color} aria-label={color} aria-pressed={edit?.color===color} style={{background:color}} onClick={()=>setEdit(value=>({...value,color}))}>{edit?.color===color&&<Check size={15}/>}</button>)}</div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="profile-editor-actions">{edit?.id&&<button type="button" className="button danger-ghost compact" disabled={busy} onClick={()=>{setRemove(edit as User);setEdit(null);}}><Trash2 size={15}/>{t("Supprimer")}</button>}<button type="button" className="button secondary" disabled={busy} onClick={()=>setEdit(null)}>{t("Annuler")}</button><button className="button primary" disabled={busy||!edit?.name?.trim()}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} {t("Enregistrer")}</button></div>
   </form>
  </Modal>
  <Confirm open={!!remove} onOpenChange={value=>{if(!value&&!busy)setRemove(null);}} title={t("Supprimer ce profil local ?")} description={t("Ses profils de jeu, thèmes, overlays et images seront supprimés de ce PC.")} action={t("Supprimer")} onConfirm={()=>void destroy()}/>
 </main>;
}
