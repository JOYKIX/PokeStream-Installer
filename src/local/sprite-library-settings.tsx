"use client";
import {useEffect,useState} from "react";
import {Download,HardDrive,Pause,RefreshCw} from "lucide-react";
import {useI18n} from "@/i18n/client";
type Snapshot={state:"idle"|"indexing"|"downloading"|"paused"|"done"|"error";done:number;total:number;downloaded:number;skipped:number;failed:number;bytes:number;message:string};
const copy={
 fr:{title:"Bibliothèque Pokémon",subtitle:"Sprites PokéAPI conservés sur ton PC, utilisables hors ligne.",note:"Le catalogue complet dépasse 10 Go. Les sprites utilisés sont automatiquement téléchargés et conservés. Tu peux aussi récupérer toute la bibliothèque pour jouer sans Internet.",start:"Télécharger tous les sprites",resume:"Reprendre le téléchargement",pause:"Mettre en pause",loading:"Téléchargement en cours",indexing:"Préparation du catalogue…",done:"Bibliothèque synchronisée",error:"Téléchargement interrompu",count:"fichiers traités",new:"nouveaux",cached:"déjà présents",failed:"indisponibles",space:"Espace téléchargé cette session"},
 en:{title:"Pokémon sprite library",subtitle:"PokéAPI sprites saved on your PC for offline use.",note:"The complete catalog exceeds 10 GB. Used sprites are downloaded and kept automatically. You can also download the entire library for offline streaming.",start:"Download all sprites",resume:"Resume download",pause:"Pause download",loading:"Downloading",indexing:"Preparing catalog…",done:"Library synced",error:"Download interrupted",count:"files processed",new:"downloaded",cached:"already present",failed:"unavailable",space:"Downloaded in this session"},
 es:{title:"Biblioteca de sprites Pokémon",subtitle:"Sprites de PokéAPI guardados en tu PC para usar sin conexión.",note:"El catálogo completo supera los 10 GB. Los sprites usados se guardan automáticamente. También puedes descargar toda la biblioteca.",start:"Descargar todos los sprites",resume:"Reanudar descarga",pause:"Pausar descarga",loading:"Descargando",indexing:"Preparando catálogo…",done:"Biblioteca sincronizada",error:"Descarga interrumpida",count:"archivos procesados",new:"descargados",cached:"ya presentes",failed:"no disponibles",space:"Descargado esta sesión"},
 de:{title:"Pokémon-Sprite-Bibliothek",subtitle:"PokéAPI-Sprites lokal gespeichert, offline verfügbar.",note:"Der vollständige Katalog ist über 10 GB groß. Verwendete Sprites werden automatisch gespeichert. Du kannst auch die ganze Bibliothek herunterladen.",start:"Alle Sprites herunterladen",resume:"Download fortsetzen",pause:"Download pausieren",loading:"Wird heruntergeladen",indexing:"Katalog wird vorbereitet…",done:"Bibliothek synchronisiert",error:"Download unterbrochen",count:"Dateien verarbeitet",new:"heruntergeladen",cached:"bereits vorhanden",failed:"nicht verfügbar",space:"In dieser Sitzung geladen"},
 ja:{title:"ポケモンスプライトライブラリ",subtitle:"PokéAPIの画像をPCに保存し、オフラインで使用できます。",note:"完全なライブラリは10GB以上です。使用した画像は自動保存されます。すべてを一括ダウンロードすることもできます。",start:"すべての画像をダウンロード",resume:"ダウンロードを再開",pause:"一時停止",loading:"ダウンロード中",indexing:"一覧を準備中…",done:"同期完了",error:"ダウンロードが中断されました",count:"処理済みファイル",new:"ダウンロード済み",cached:"保存済み",failed:"取得不可",space:"今回のダウンロード容量"}
};
export function SpriteLibrarySettings(){
 const {locale,t:tr}=useI18n();const t=copy[locale]||copy.en;
 const [status,setStatus]=useState<Snapshot|null>(null);const [error,setError]=useState("");
 useEffect(()=>{let active=true;
  const refresh=async()=>{try{const r=await fetch("/api/local/sprites",{cache:"no-store"});if(r.ok&&active)setStatus(await r.json());}catch{}};
  void refresh();const timer=setInterval(()=>void refresh(),1500);return ()=>{active=false;clearInterval(timer);};
 },[]);
 async function action(value:"start"|"pause"){
  setError("");
  try{const r=await fetch("/api/local/sprites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:value})});
   if(!r.ok)throw Error("HTTP "+r.status);setStatus(await r.json());
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 }
 const active=status?.state==="downloading"||status?.state==="indexing";
 return <section className="local-settings-panel"><div className="local-settings-panel-head"><HardDrive size={20}/><div><h2>{t.title}</h2><p>{t.subtitle}</p></div></div>
  <div className="local-settings-action">
   <small>{t.note}</small>
   {status&&status.total>0&&<><progress className="sprite-download-progress" max={status.total} value={status.done}/><small>{status.done.toLocaleString(locale)} / {status.total.toLocaleString(locale)} {t.count} · {status.downloaded.toLocaleString(locale)} {t.new} · {status.skipped.toLocaleString(locale)} {t.cached} · {status.failed} {t.failed}</small><small>{t.space}: {(status.bytes/1048576).toLocaleString(locale,{maximumFractionDigits:1})} {locale==="fr"?"Mo":"MB"}</small></>}
   {active?<button type="button" className="button secondary" onClick={()=>void action("pause")}><Pause size={16}/>{t.pause}</button>:<button type="button" className="button secondary" onClick={()=>void action("start")}>{status?.state==="paused"||status?.state==="error"?<RefreshCw size={16}/>:<Download size={16}/>} {status?.state==="paused"||status?.state==="error"?t.resume:t.start}</button>}
   {status?.state==="indexing"&&<small>{t.indexing}</small>}
   {status?.state==="downloading"&&<small>{t.loading}</small>}
   {status?.state==="done"&&<small>{t.done}</small>}
   {status?.message&&<small role="status">{tr(status.message)}</small>}
   {error&&<small role="alert">{error}</small>}
  </div></section>;
}
