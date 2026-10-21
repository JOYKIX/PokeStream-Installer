"use client";
import { memo, useEffect, useRef, useState, useMemo, useDeferredValue, type MouseEvent as ReactMouseEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, LoaderCircle, Palette, Plus, RotateCcw, Save, Trash2, Undo2, Redo2, LockKeyhole, ArrowUpRight, Upload, Download, Expand, ClipboardPaste } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { authFetch } from "@/local/client";
import { OverlayStage, type OverlayDimensions } from "@/components/overlay-stage";
import { ColorPicker } from "@/components/color-picker";
import { Select, SelectOption } from "@/components/select";
import { ShareCreation } from "@/components/share-creation";
import { Confirm, Modal } from "@/components/ui";
import { ChoiceControl } from "./controls";
import { ThemeSettings } from "./editor-settings";
import { sections, sectionKeys, sectionSizes, surfaceKeys, palettes, applyPalette, themeFileSchema, previewStates, type Section, type PreviewState } from "./editor-options";
import { CUSTOM_THEME_LIMIT, customThemeSchema, defaultCustomTheme, customThemePreset, themeInputSchema, type CustomTheme, type ThemeInput, type ThemeSurface } from "./schema";
import { CustomThemeSample } from "./sample";
import { themePreview, type PreviewProfile } from "./preview";

const defaults = defaultCustomTheme();
const PreviewStage = memo(OverlayStage);
const input = (theme: CustomTheme): ThemeInput => ({ name: theme.name, config: theme.config });
export function ThemeStudio({ initialThemes, active, profiles = [], profilesUnavailable = false, initialThemeId }: { initialThemes: CustomTheme[]; active: boolean; profiles?: PreviewProfile[]; profilesUnavailable?: boolean; initialThemeId?: string }) {
 const { t } = useI18n();
 const router = useRouter();
 const [themes, setThemes] = useState(initialThemes);
 const first = initialThemes.find((theme)=>theme.id===initialThemeId) ?? initialThemes[0];
 const [selected, setSelected] = useState<CustomTheme | null>(first ?? null);
 const [draft, setDraft] = useState<ThemeInput>(() => first ? input(first) : { name: t("Mon thème"), config: defaultCustomTheme() });
 const [baseline, setBaseline] = useState(() => JSON.stringify(first ? input(first) : { name: t("Mon thème"), config: defaultCustomTheme() }));
 const [section, setSection] = useState<Section>("general");
 const [part, setPart] = useState("all");
 const [layout, setLayout] = useState<"6x1" | "1x6" | "3x2" | "2x3">("3x2");
 const [background, setBackground] = useState("grid");
 const [backgroundColor,setBackgroundColor] = useState("#172235");
 const [profileId,setProfileId] = useState("sample");
 const [previewState,setPreviewState] = useState<PreviewState>("original");
 const [expanded,setExpanded] = useState(false);
 const [surfaceClipboard,setSurfaceClipboard] = useState<ThemeSurface|null>(null);
 const importInput=useRef<HTMLInputElement>(null);
 const lastEdit=useRef({key:"",time:0});
 const previewFrame=useRef<HTMLDivElement>(null);
 const [previewHeight, setPreviewHeight] = useState(360);
 useEffect(() => {
   const frame=previewFrame.current;
   if(!frame)return;
   const resize=()=>setPreviewHeight(Math.max(80,frame.clientHeight-32));
   const observer=new ResizeObserver(resize);
   observer.observe(frame);resize();
   return ()=>observer.disconnect();
 }, []);
 const [dimensions, setDimensions] = useState<OverlayDimensions | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [notice, setNotice] = useState("");
 const [newOpen, setNewOpen] = useState(false);
 const [deleteOpen, setDeleteOpen] = useState(false);
 const [pending, setPending] = useState<(() => void) | null>(null);
 const [resetOpen, setResetOpen] = useState(false);
 const history = useRef<{ past: ThemeInput[]; future: ThemeInput[] }>({ past: [], future: [] });
 const [historyStatus, setHistoryStatus] = useState({past:0,future:0});
 const syncHistory = () => setHistoryStatus({past:history.current.past.length,future:history.current.future.length});
 const newId = useRef<string | null>(null);
 const editing = active && !busy;
 const dirty = JSON.stringify(draft) !== baseline;
 const needsSave = dirty || !selected;
 const valid = themeInputSchema.safeParse(draft).success;
 const config = draft.config;
 const previewConfig = useDeferredValue(config);
 const profile = profiles.find((p)=>p.id===profileId);
 const preview = useMemo(() => themePreview(previewConfig, layout, profile?.data, previewState), [previewConfig, layout, profile, previewState]);
 const newAllowed = themes.length < CUSTOM_THEME_LIMIT && active;
 const askToLeave = (action: () => void) => dirty && active ? setPending(() => action) : action();
 function change(next: ThemeInput, key = "") {
   if (!editing || JSON.stringify(next) === JSON.stringify(draft)) return;
   const now=performance.now();
   if (!key || key!==lastEdit.current.key || now-lastEdit.current.time>500)
     history.current.past = [...history.current.past.slice(-59), draft];
   lastEdit.current={key,time:now};
   history.current.future = [];
   syncHistory(); setDraft(next); setNotice("");
 }
 function undo(redo = false) {
   lastEdit.current={key:"",time:0};
   const from = redo ? history.current.future : history.current.past;
   const to = redo ? history.current.past : history.current.future;
   const previous = from.pop();
   if (previous) { to.push(draft); setDraft(previous); syncHistory(); setNotice(""); }
 }
 function select(theme: CustomTheme) {
   lastEdit.current={key:"",time:0};
   setSelected(theme); setDraft(input(theme)); setBaseline(JSON.stringify(input(theme)));
   history.current = { past: [], future: [] }; syncHistory(); newId.current = null; setError(""); setNotice("");
 }
 function create(preset: "dark" | "light" | "pixel", duplicate = false) {
   if (!newAllowed) return;
   const next = duplicate ? { name: (draft.name + " · " + t("Copie")).slice(0, 40), config: structuredClone(config) }
     : { name: t("Mon thème") + " " + (themes.length + 1), config: customThemePreset(preset) };
   setSelected(null); setDraft(next); setBaseline(""); newId.current = crypto.randomUUID();
   history.current = { past: [], future: [] }; syncHistory(); setNewOpen(false); setError(""); setNotice("");
 }
 useEffect(() => {
   if (!dirty || !active) return;
   const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
   const navigation = (e: MouseEvent) => {
     if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
     const anchor = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
     if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
     const url = new URL(anchor.href, window.location.href);
     if (url.origin !== window.location.origin || url.href === window.location.href) return;
     e.preventDefault(); e.stopPropagation();
     setPending(() => () => router.push(url.pathname + url.search + url.hash));
   };
   window.addEventListener("beforeunload", unload);
   document.addEventListener("click", navigation, true);
   return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigation, true); };
 }, [dirty, active, router]);
 async function reload() {
   setBusy(true); setError("");
   try {
     const response = await authFetch("/api/themes/custom", { cache: "no-store", signal: AbortSignal.timeout(12000) });
     const result = await response.json();
     if (!response.ok) throw new Error(result.error);
     const next = customThemeSchema.array().parse(result.themes);
     setThemes(next);
     const found = next.find((theme) => theme.id === selected?.id) ?? next[0];
     if (found) select(found);
     else { setSelected(null); setDraft({ name: t("Mon thème"), config: defaultCustomTheme() }); setBaseline(JSON.stringify({ name: t("Mon thème"), config: defaultCustomTheme() })); newId.current = null; history.current = { past: [], future: [] }; syncHistory(); }
   } catch (e) { setError(e instanceof Error ? e.message : "Chargement des thèmes impossible."); }
   finally { setBusy(false); }
 }
 async function save() {
   if (!active || busy || !valid || (!selected && !newAllowed)) return;
   setBusy(true); setError(""); setNotice("");
   try {
     newId.current ??= crypto.randomUUID();
     const response = await authFetch("/api/themes/custom" + (selected ? "/" + selected.id : ""), {
       method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ ...draft, ...(selected ? { version: selected.version } : { id: newId.current }) }),
       signal: AbortSignal.timeout(15000),
     });
     const result = await response.json();
     if (!response.ok) throw new Error(result.error || "Enregistrement du thème impossible. Réessaie.");
     const theme = customThemeSchema.parse(result.theme);
     setThemes((old) => [...old.filter((v) => v.id !== theme.id), theme].sort((a, b) => a.slot - b.slot));
     select(theme); setNotice(t("Thème enregistré"));
   } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement du thème impossible. Réessaie."); }
   finally { setBusy(false); }
 }
 async function remove() {
   if (!selected || busy) return;
   setBusy(true); setError(""); setDeleteOpen(false);
   try {
     const response = await authFetch("/api/themes/custom/" + selected.id, {
       method: "DELETE", headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ version: selected.version }), signal: AbortSignal.timeout(15000),
     });
     const result = await response.json();
     if (!response.ok) throw new Error(result.error);
     const next = themes.filter((theme) => theme.id !== selected.id);
     setThemes(next);
     if (next[0]) select(next[0]);
     else { setSelected(null); setDraft({ name: t("Mon thème"), config: defaultCustomTheme() }); setBaseline(JSON.stringify({ name: t("Mon thème"), config: defaultCustomTheme() })); newId.current = null; history.current = { past: [], future: [] }; syncHistory(); }
     setNotice(t("Thème supprimé"));
   } catch (e) { setError(e instanceof Error ? e.message : "Suppression du thème impossible."); }
   finally { setBusy(false); }
 }
 function resetSection() {
   const patch = Object.fromEntries(sectionKeys[section].map((key) => [key, structuredClone(defaults[key])]));
   const sizes = { ...config.sizes, ...Object.fromEntries((sectionSizes[section] ?? []).map((key) => [key, defaults.sizes[key]])) };
   change({ ...draft, config: { ...config, ...patch, sizes } });
 }

 function keyboard(event: KeyboardEvent<HTMLElement>) {
   if (!(event.ctrlKey || event.metaKey)) return;
   const key=event.key.toLowerCase();
   if(key==="s"){event.preventDefault();if(editing&&needsSave&&valid)void save();return;}
   const target=event.target as HTMLElement;
   if(target.closest('input,textarea,[contenteditable="true"],[role="dialog"]'))return;
   if(editing&&(key==="z"||key==="y")){event.preventDefault();undo(key==="y"||event.shiftKey);}
 }
 function pickElement(event: ReactMouseEvent<HTMLDivElement>) {
   const target=event.target as Element;
   const rules: [string,Section][]=[
     [".overlay-held-item","item"],[".overlay-gender","gender"],[".type-pill","types"],
     [".overlay-health-row","health"],[".overlay-health","health"],[".overlay-mon-art","sprite"],
     [".overlay-name-line","text"],[".overlay-level","text"],[".overlay-badges","badges"],
     [".overlay-deaths","counter"],[".overlay-mon","card"],
   ];
   const found=rules.find(([selector])=>target.closest(selector));
   if(found)setSection(found[1]);
 }
 function exportTheme(){
   const parsed=themeInputSchema.safeParse(draft);
   if(!parsed.success)return;
   const blob=new Blob([JSON.stringify({format:"pokestream-theme",version:1,theme:parsed.data},null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download=(draft.name.replace(/[^\p{L}\p{N}_-]+/gu,"-").slice(0,40)||"theme")+".pokestream-theme.json";
   a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importTheme(file?:File){
   if(!file||!newAllowed||busy)return;
   try {
     if(file.size>20000)throw new Error("Fichier de thème invalide.");
     const parsed=themeFileSchema.safeParse(JSON.parse(await file.text()));
     if(!parsed.success)throw new Error("Fichier de thème invalide.");
     const next=parsed.data.theme;
     askToLeave(()=>{
       setSelected(null);setDraft(next);setBaseline("");
       newId.current=crypto.randomUUID();history.current={past:[],future:[]};syncHistory();
       lastEdit.current={key:"",time:0};setNotice(t("Thème importé. Enregistre-le pour l’utiliser."));setError("");
     });
   }catch{setError(t("Fichier de thème invalide."));}
   finally{if(importInput.current)importInput.current.value="";}
 }
 const sectionLabel=sections.find(([id])=>id===section)![1];
 const surfaceKey=surfaceKeys[section as keyof typeof surfaceKeys];
 const status=notice||(dirty?t("Modifications non enregistrées"):selected?t("Enregistré"):t("Nouveau thème"));
 return <main className="theme-studio" onKeyDown={keyboard} onPointerUpCapture={()=>{lastEdit.current.key="";}}>
  <header className="ts-heading">
   <div><span className="section-label">{t("MES THÈMES")}</span><h1>{t("Theme Creator")}<span className="ts-count">{themes.length}/{CUSTOM_THEME_LIMIT}</span></h1></div>
   <div className="ts-heading-actions">
    <button type="button" className="icon-button" disabled={!editing||!historyStatus.past} aria-label={t("Annuler la modification")} title={t("Annuler la modification")+" · Ctrl Z"} onClick={()=>undo()}><Undo2 size={17}/></button>
    <button type="button" className="icon-button" disabled={!editing||!historyStatus.future} aria-label={t("Rétablir")} title={t("Rétablir")+" · Ctrl Maj Z"} onClick={()=>undo(true)}><Redo2 size={17}/></button>
    <Link href="/studio" className="button secondary compact">{t("Studio")}<ArrowUpRight size={15}/></Link>
    <button type="button" className="button primary compact" disabled={!editing||!needsSave||!valid||(!selected&&!newAllowed)} onClick={()=>void save()}>
     {busy?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>} {t("Enregistrer")}
    </button>
   </div>
  </header>
  
  {error&&<div className="ts-message error" role="alert"><span>{t(error)}</span><button type="button" disabled={busy} onClick={()=>askToLeave(()=>void reload())}>{t("Recharger la bibliothèque")}</button></div>}
  <div className="ts-workspace">
   <aside className="ts-library" aria-label={t("Bibliothèque et outils")}>
    <div className="ts-library-heading"><h2>{t("Mes thèmes")}</h2><button type="button" className="icon-button" disabled={!newAllowed||busy} title={t("Nouveau thème")} aria-label={t("Nouveau thème")} onClick={()=>askToLeave(()=>setNewOpen(true))}><Plus size={17}/></button></div>
    <div className="ts-theme-list">
     {themes.map((theme)=><button type="button" key={theme.id} disabled={busy} aria-pressed={selected?.id===theme.id} className={"ts-theme-card"+(selected?.id===theme.id?" selected":"")} onClick={()=>{if(selected?.id!==theme.id)askToLeave(()=>select(theme));}}>
      <CustomThemeSample config={theme.config}/><span>{theme.name}</span>{selected?.id===theme.id&&<Check size={14}/>}
     </button>)}
     {!themes.length&&<p className="ts-muted">{t("Aucun thème enregistré.")}</p>}
     {!selected&&<div className="ts-draft-row"><Palette size={15}/><span>{draft.name||t("Nouveau thème")}</span><span className="ts-dot"/></div>}
    </div>
    <div className="ts-library-actions">
     <button type="button" disabled={!newAllowed||busy} onClick={()=>askToLeave(()=>setNewOpen(true))}><Plus size={14}/>{t("Créer")}</button>
     <button type="button" disabled={!newAllowed||busy} onClick={()=>importInput.current?.click()}><Upload size={14}/>{t("Importer")}</button>
     <input ref={importInput} type="file" hidden accept=".json,application/json" onChange={(event)=>void importTheme(event.target.files?.[0])}/>
    </div>
    <nav className="ts-section-nav" aria-label={t("Élément à modifier")}>
     {sections.map(([id,label,Icon])=><button key={id} type="button" aria-current={section===id?"true":undefined} onClick={()=>setSection(id)}><Icon size={16}/><span>{t(label)}</span></button>)}
    </nav>
    <p className="ts-library-note">{t("Disponibles dans Studio → Style → Mes thèmes.")}</p>
   </aside>
   <section className="ts-canvas" aria-label={t("Aperçu")}>
    <div className="ts-sourcebar">
     <label htmlFor="theme-preview-source">{t("Aperçu avec")}</label>
     <Select id="theme-preview-source" value={profileId} onValueChange={setProfileId}>
      <SelectOption value="sample">{t("Équipe d’exemple")}</SelectOption>
      {profiles.map((p)=><SelectOption key={p.id} value={p.id}>{p.name}</SelectOption>)}
     </Select>
     <button type="button" className="icon-button" title={t("Agrandir l’aperçu")} aria-label={t("Agrandir l’aperçu")} onClick={()=>setExpanded(true)}><Expand size={17}/></button>
    </div>
    {profilesUnavailable&&<p className="ts-preview-note">{t("Profils indisponibles. L’équipe d’exemple reste disponible.")}</p>}
    <div className="ts-preview-toolbar">
     <div className="ts-preview-tabs" role="group" aria-label={t("Source affichée")}>
      {([["all","Tout"],["team","Équipe"],["slot-1","Pokémon"],["badges","Badges"],["deaths","Nuzlocke"]] as const).map(([id,label])=><button type="button" key={id} aria-pressed={id==="slot-1"?part.startsWith("slot-"):part===id} onClick={()=>setPart(id)}>{t(label)}</button>)}
     </div>
     <div className="ts-backgrounds" role="group" aria-label={t("Fond de l’aperçu")}>
      {["grid","dark","light"].map((id)=><button type="button" key={id} className={"ts-bg-"+id} aria-pressed={background===id} aria-label={t(id==="grid"?"Damier":id==="dark"?"Sombre":"Clair")} title={t(id==="grid"?"Damier":id==="dark"?"Sombre":"Clair")} onClick={()=>setBackground(id)}/>)}
      <ColorPicker label="Fond de l’aperçu" value={backgroundColor} onChange={(color)=>{setBackgroundColor(color);setBackground("custom");}}/>
     </div>
    </div>
    <div ref={previewFrame} className={"ts-preview ts-bg-"+background} data-section={section} onClick={pickElement} style={background==="custom"?{background:backgroundColor}:undefined}>
     <PreviewStage data={preview} part={part} maxHeight={previewHeight} onDimensions={setDimensions}/>
    </div>
    <div className="ts-preview-footer">
     <div className="ts-preview-tabs" role="group" aria-label={t("Disposition de l’équipe")}>
      {(["6x1","3x2","2x3","1x6"] as const).map((id)=><button type="button" key={id} aria-pressed={layout===id} onClick={()=>setLayout(id)}>{id.replace("x"," × ")}</button>)}
     </div><span>{dimensions?.part===part?dimensions.width+" × "+dimensions.height:"—"} px</span>
    </div>
    <details className="ts-preview-details" open><summary>{t("Réglages de l’aperçu")}</summary><div className="ts-preview-options">
     <ChoiceControl label="Simulation" value={previewState} choices={previewStates} onChange={setPreviewState}/>
     {part.startsWith("slot-")&&<ChoiceControl label="Emplacement" value={part} choices={[1,2,3,4,5,6].map((i)=>["slot-"+i,String(i)] as const)} onChange={setPart}/>}
    </div>
    </details><div className="ts-draft-toolbar"><span role="status">{status}</span><span className="ts-muted">Ctrl S</span></div>
    <p className="ts-preview-note">{t("Clique un élément de l’aperçu pour le modifier.")}</p>
   </section>
   <section className="ts-settings" aria-label={t("Réglages du thème")}>
    <div className="ts-settings-top">
     <label className="field">{t("Nom du thème")}<input type="text" value={draft.name} maxLength={40} disabled={!editing} onChange={(event)=>change({...draft,name:event.target.value},"name")}/></label>
     <div className="ts-manage-actions">
      <button type="button" disabled={!editing||!newAllowed} onClick={()=>create("dark",true)} title={t("Dupliquer")}><Copy size={14}/>{t("Dupliquer")}</button>
      <button type="button" disabled={!valid} onClick={exportTheme} title={t("Exporter")}><Download size={14}/>{t("Exporter")}</button>
      {selected&&<ShareCreation key={selected.id} kind="theme" sourceId={selected.id} version={selected.version} name={selected.name} disabled={busy||dirty||!active}/>}
      <button type="button" disabled={!selected||busy} onClick={()=>setDeleteOpen(true)} aria-label={t("Supprimer")} title={t("Supprimer")}><Trash2 size={14}/></button>
     </div>
    </div>
    <fieldset key={section} className="ts-settings-scroll" disabled={!editing}>
     <div className="ts-section-title"><h2>{t(sectionLabel)}</h2><button type="button" className="ts-reset" title={t("Réinitialiser cette section")} aria-label={t("Réinitialiser cette section")} onClick={resetSection}><RotateCcw size={15}/></button></div>
     {section==="general"&&<div className="ts-palette-section"><h3>{t("Palettes coordonnées")}</h3><div className="ts-palettes">
      {palettes.map((palette,index)=><button key={palette.name} type="button" title={t(palette.name)} onClick={()=>change({...draft,config:applyPalette(config,index)})}><span>{[palette.base,palette.panel,palette.accent,palette.text].map((color,i)=><i key={i} style={{background:color}}/>)}</span><small>{t(palette.name)}</small></button>)}
     </div></div>}
     {surfaceKey&&<div className="ts-surface-tools">
      <button type="button" onClick={()=>setSurfaceClipboard(structuredClone(config[surfaceKey]))}><Copy size={13}/>{t("Copier le fond")}</button>
      <button type="button" disabled={!surfaceClipboard} onClick={()=>{if(surfaceClipboard)change({...draft,config:{...config,[surfaceKey]:structuredClone(surfaceClipboard)}});}}><ClipboardPaste size={13}/>{t("Coller")}</button>
     </div>}
     <ThemeSettings config={config} section={section} onChange={(next,key)=>change({...draft,config:next},key)}/>
     {section==="general"&&<button type="button" className="ts-reset-all" onClick={()=>setResetOpen(true)}><RotateCcw size={14}/>{t("Tout réinitialiser")}</button>}
    </fieldset>
   </section>
  </div>
  <Modal open={expanded} onOpenChange={setExpanded} title={draft.name||t("Aperçu")} wide>
   <div className={"ts-full-preview ts-bg-"+background} style={background==="custom"?{background:backgroundColor}:undefined}><PreviewStage data={preview} part={part} maxHeight={Math.max(320,previewHeight*1.4)}/></div>
  </Modal>
  <Modal open={newOpen} onOpenChange={setNewOpen} title={t("Nouveau thème")} description={t("Choisis une base de départ.")}>
   <div className="ts-presets">{([["dark","Sombre"],["light","Clair"],["pixel","Pixel"]] as const).map(([id,label])=><button key={id} type="button" onClick={()=>create(id)}><CustomThemeSample config={customThemePreset(id)}/><strong>{t(label)}</strong></button>)}</div>
  </Modal>
  <Confirm open={!!pending} onOpenChange={(open)=>{if(!open)setPending(null);}} title={t("Quitter sans enregistrer ?")} description={t("Les modifications non enregistrées seront perdues.")} action={t("Continuer")} onConfirm={()=>{const action=pending;setPending(null);action?.();}}/>
  <Confirm open={deleteOpen} onOpenChange={setDeleteOpen} title={t("Supprimer ce thème ?")} description={t("Les overlays qui l’utilisent reviendront au thème Carbone.")} action={t("Supprimer")} onConfirm={()=>void remove()}/>
  <Confirm open={resetOpen} onOpenChange={setResetOpen} title={t("Réinitialiser le thème ?")} description={t("Tous les réglages reviendront aux valeurs par défaut. Le nom sera conservé.")} action={t("Réinitialiser")} onConfirm={()=>{change({...draft,config:defaultCustomTheme()});setResetOpen(false);}}/>
 </main>;
}
