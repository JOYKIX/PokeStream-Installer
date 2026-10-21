"use client";
import {useEffect,useRef,useState} from "react";
import {Plus,Pencil,Check,ImagePlus,Trash2} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {Modal} from "@/components/ui";
type User={id:string;name:string;color:string;avatar:string};
const colors=["#b12c43","#335ba5","#387c6a","#8757a2","#b57835","#555e79"];
export function LocalUsers(){
 const {t}=useI18n(),[users,setUsers]=useState<User[]>([]),[loading,setLoading]=useState(true),[manage,setManage]=useState(false),[edit,setEdit]=useState<Partial<User>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[remove,setRemove]=useState<User|null>(null),file=useRef<HTMLInputElement>(null);
 async function reload(){const r=await fetch("/api/local/users",{cache:"no-store"});if(!r.ok)throw Error();setUsers((await r.json()).users);}
 useEffect(()=>{let stopped=false;queueMicrotask(()=>{if(!stopped)reload().catch(()=>{if(!stopped)setError(t("Chargement impossible. Réessaie."));}).finally(()=>{if(!stopped)setLoading(false);});});return ()=>{stopped=true;};},[t]);
 async function send(method:string,body:unknown){const r=await fetch("/api/local/users",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok){const result=await r.json().catch(()=>({}));throw Error(result.error||"request_failed");}}
 function errorMessage(error:unknown,fallback:string){const key=error instanceof Error?error.message:"";return t(key==="origin_refused"?"Requête locale refusée. Ferme puis relance PokeStream.":key==="profile_invalid"?"Vérifie le nom, la couleur et l’image du profil.":key==="storage_unavailable"?"Impossible d’enregistrer sur ce PC. Ouvre les logs depuis le launcher.":key==="profile_missing"?"Ce profil n’existe plus. Actualise la page.":fallback);}
 async function select(u:User){if(manage){setEdit(u);return;}setBusy(true);try{await send("PATCH",{id:u.id,select:true});window.location.assign("/studio");}catch(error){setError(errorMessage(error,"Impossible d’ouvrir ce profil."));setBusy(false);}}
 async function save(e:React.FormEvent){e.preventDefault();if(!edit?.name?.trim())return;setBusy(true);setError("");try{const details={name:edit.name.trim(),color:edit.color||colors[0],avatar:edit.avatar||""};await send(edit.id?"PATCH":"POST",edit.id?{id:edit.id,details}:details);await reload();setEdit(null);}catch(error){setError(errorMessage(error,"Enregistrement impossible."));}finally{setBusy(false);}}
 async function avatar(f?:File){if(!f)return;if(!f.type.startsWith("image/")||f.size>20*1024*1024){setError(t("Image trop volumineuse (20 Mo maximum)."));return;}
 const bitmap=await createImageBitmap(f);const canvas=document.createElement("canvas");canvas.width=canvas.height=192;const ctx=canvas.getContext("2d")!;const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,192,192);bitmap.close();setEdit(v=>({...v,avatar:canvas.toDataURL("image/png")}));}
 return <main className="local-users" id="main"><span className="section-label">POKESTREAM</span><h1>{t(manage?"Gérer les profils locaux":"Qui utilise PokeStream ?")}</h1><p>{t("Chaque profil conserve ses créations sur ce PC.")}</p>
 {error&&<p className="error-banner" role="alert">{error}</p>}
 <div className="local-user-list">{loading?<p role="status">{t("Chargement…")}</p>:users.map(u=><button className="local-user" key={u.id} disabled={busy} onClick={()=>void select(u)}><span className="local-avatar" style={{background:u.color}}>{u.avatar?<img src={u.avatar} alt=""/>:u.name.slice(0,2).toUpperCase()}{manage&&<i><Pencil size={20}/></i>}</span><strong>{u.name}</strong></button>)}
 {!loading&&<button className="local-user add" disabled={busy} onClick={()=>setEdit({name:"",color:colors[users.length%colors.length],avatar:""})}><span className="local-avatar"><Plus size={38}/></span><strong>{t("Ajouter")}</strong></button>}</div>
 {!!users.length&&<button className="button secondary" onClick={()=>setManage(!manage)}>{manage?<Check size={16}/>:<Pencil size={16}/>} {t(manage?"Terminer":"Gérer les profils locaux")}</button>}
 <Modal open={!!edit} onOpenChange={v=>!v&&!busy&&setEdit(null)} title={t(edit?.id?"Modifier le profil local":"Nouveau profil local")}><form className="local-user-form" onSubmit={save}>
 <button type="button" className="avatar-edit" onClick={()=>file.current?.click()}><span className="local-avatar" style={{background:edit?.color}}>{edit?.avatar?<img src={edit.avatar} alt=""/>:edit?.name?.slice(0,2).toUpperCase()||<ImagePlus/>}</span>{t("Choisir une image")}</button>
 <input hidden ref={file} type="file" accept="image/*" onChange={e=>void avatar(e.target.files?.[0]).catch(()=>setError(t("Image invalide.")))}/>
 <label>{t("Nom")}<input autoFocus maxLength={32} required value={edit?.name||""} onChange={e=>setEdit(v=>({...v,name:e.target.value}))}/></label>
 <div className="local-user-colors">{colors.map(c=><button type="button" key={c} aria-label={c} aria-pressed={edit?.color===c} style={{background:c}} onClick={()=>setEdit(v=>({...v,color:c}))}>{edit?.color===c&&<Check size={16}/>}</button>)}</div>
 <div className="form-actions">{edit?.id&&<button type="button" className="button danger" onClick={()=>{setRemove(edit as User);setEdit(null);}}><Trash2 size={16}/>{t("Supprimer")}</button>}<button className="button primary" disabled={busy||!edit?.name?.trim()}>{t("Enregistrer")}</button></div></form></Modal>
 <Modal open={!!remove} onOpenChange={v=>!v&&!busy&&setRemove(null)} title={t("Supprimer ce profil local ?")} description={t("Ses profils de jeu, thèmes, overlays et images seront supprimés de ce PC.")}><div className="form-actions"><button className="button secondary" disabled={busy} onClick={()=>setRemove(null)}>{t("Annuler")}</button><button className="button danger" disabled={busy} onClick={async()=>{setBusy(true);try{await send("DELETE",{id:remove!.id,confirm:true});setRemove(null);await reload();}catch{setError(t("Suppression impossible."));}finally{setBusy(false);}}}>{t("Supprimer")}</button></div></Modal>
 </main>;
}
