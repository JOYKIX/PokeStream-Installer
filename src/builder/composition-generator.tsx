"use client";
import {useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction} from "react";
import {Camera, Check, LayoutGrid, LoaderCircle, Monitor, WandSparkles} from "lucide-react";
import {Modal, Toggle} from "@/components/ui";
import {ChoiceGroup, TeamLayoutChoices} from "@/components/choice-group";
import {useI18n} from "@/i18n/client";
import {demoScene} from "@/lib/demo";
import {GAMES} from "@/lib/games";
import {teamLayout as sceneTeamLayout} from "@/lib/overlay-layout";
import type {SceneData} from "@/lib/model";
import {BuilderCanvas, ElementContent, type DisplayTheme} from "./render";
import {newElement, external, type BuilderData, type BuilderElement} from "./schema";
import type {BoundsReporter, ContentBounds} from "./geometry";
import {COMPOSITION_CONSOLES, compositionBadgeColumns, type CompositionMeasurements, type CompositionOptions, type CompositionProposal} from "./composition-layout";

const names = {main: "Écran supérieur", secondary: "Écran inférieur", camera: "Caméra", chat: "Chat", team: "Équipe", badges: "Badges", counter: "Nuzlocke"};
type Props = {data: BuilderData; scene: SceneData | null; themes: DisplayTheme[]; onApply: (data: BuilderData) => void};
function initialOptions(data: BuilderData, scene: SceneData | null): CompositionOptions {
  const main = data.elements.find(e => e.type === "game-screen"), team = data.elements.find(e => e.type === "team"), badges = data.elements.find(e => e.type === "badges");
  const platform = main?.type === "game-screen" ? main.properties.platform : "ds";
  const console = platform.startsWith("3ds") ? "3ds" : COMPOSITION_CONSOLES.find(c => c === platform) ?? "ds";
  return {console, screens: "side", camera: true, chat: false, team: true, badges: true, counter: false, teamLayout: team?.type === "team" ? team.properties.layout ?? (scene ? sceneTeamLayout(scene.style) : "6x1") : scene ? sceneTeamLayout(scene.style) : "6x1", badgeColumns: badges?.type === "badges" ? badges.properties.columns ?? "auto" : "auto", cameraRatio: 16 / 9, focus: "game"};
}
export function CompositionPreview({data, scene, themes}: Omit<Props, "onApply">) {
  const ref = useRef<HTMLDivElement>(null), [width, setWidth] = useState(600);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div className="composition-preview" ref={ref}><div style={{width: 1920, height: 1080, transform: `scale(${width / 1920})`, transformOrigin: "top left"}}><BuilderCanvas data={data} scene={scene} themes={themes} placeholders/></div></div>;
}
function MeasuredContent({data, scene, themes, options, onBounds}: Omit<Props, "onApply"> & {scene: SceneData; options: CompositionOptions; onBounds: BoundsReporter}) {
  const elements = useMemo(() => {
    const team = newElement("team", "team"), counter = newElement("nuzlocke", "counter");
    if (team.type === "team") team.properties = {layout: options.teamLayout, scale: 1};
    if (counter.type === "nuzlocke") counter.properties = {scale: 1};
    team.id = "team";counter.id = "counter";
    return [team, counter, ...compositionBadgeColumns(options.badgeCount ?? 8).map(columns => {
      const badge = newElement("badges", "badges");badge.id = "badges-" + columns;
      if (badge.type === "badges") badge.properties = {columns, scale: 1};
      return badge;
    })];
  }, [options.teamLayout, options.badgeCount]);
  return <div className="composition-measure" aria-hidden="true">{elements.map(element => <ElementContent key={element.id} element={element} data={data} scene={scene} themes={themes} onBounds={onBounds}/>)}</div>;
}
function useProposals(options: CompositionOptions, measured: CompositionMeasurements, ready: boolean) {
  const worker = useRef<Worker | null>(null), currentKey = useRef("");
  const key = JSON.stringify([options, measured]), [result, setResult] = useState<{key: string; proposals?: CompositionProposal[]; error?: boolean}>({key: ""});
  useEffect(() => {
    const instance = new Worker(new URL("./composition-worker.ts", import.meta.url), {type: "module"});
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<typeof result>) => { if (event.data.key === currentKey.current) setResult(event.data); };
    instance.onerror = () => setResult({key: currentKey.current, error: true});
    return () => {worker.current = null;instance.terminate();};
  }, []);
  useEffect(() => {currentKey.current = key;if (ready) worker.current?.postMessage({key, options, measured});}, [key, options, measured, ready]);
  return {proposals: result.proposals ?? [], pending: !ready || result.key !== key, error: result.key === key && result.error};
}
function LayoutThumbnail({proposal}: {proposal: CompositionProposal}) {
  return <svg viewBox="0 0 1920 1080" aria-hidden="true">{proposal.placements.map(p => <rect key={p.role} x={p.x} y={p.y} width={p.width} height={p.height} rx={16} className={"layout-role-" + p.role}/>)}</svg>;
}
function CompositionControls({options, setOptions, badgeCount}: {options: CompositionOptions; setOptions: Dispatch<SetStateAction<CompositionOptions>>; badgeCount: number}) {
  const {t} = useI18n();
  const change = <K extends keyof CompositionOptions>(key: K, value: CompositionOptions[K]) => setOptions(previous => ({...previous, [key]: value}));
  return <div className="composition-options">
    <section className="composition-section"><h3><Monitor size={15}/>{t("Écrans")}</h3>
      <div className="composition-consoles" role="group" aria-label={t("Console")}>{COMPOSITION_CONSOLES.map(c => <button key={c} type="button" aria-pressed={options.console === c} onClick={() => change("console", c)}>{c === "switch" ? "Switch" : c.toUpperCase()}</button>)}</div>
      {["ds", "3ds"].includes(options.console) && <ChoiceGroup label={t("Disposition des écrans")} value={options.screens} columns={2} options={[{value: "side", label: t("Écran secondaire à droite")}, {value: "stack", label: t("Écrans empilés")}]} onChange={value => change("screens", value)}/>}
      <span className="composition-label">{t("Répartition de l’espace")}</span><ChoiceGroup label={t("Répartition de l’espace")} value={options.focus ?? "game"} columns={2} options={[{value: "game", label: t("Priorité au jeu")}, {value: "balanced", label: t("Équilibrée")}]} onChange={value => change("focus", value)}/>
    </section>
    <section className="composition-section"><h3><LayoutGrid size={15}/>{t("Pokémon et badges")}</h3>
      <div className="composition-control"><Toggle label="Équipe" checked={options.team} onChange={value => change("team", value)}/>{options.team && <TeamLayoutChoices value={options.teamLayout ?? "6x1"} onChange={value => change("teamLayout", value)}/>}</div>
      <div className="composition-control"><Toggle label="Badges" checked={options.badges && badgeCount > 0} disabled={!badgeCount} onChange={value => change("badges", value)}/>{badgeCount ? options.badges && <ChoiceGroup label={t("Disposition des badges")} value={String(options.badgeColumns ?? "auto")} className="composition-badge-choices" options={[{value: "auto", label: t("Automatique")}, ...compositionBadgeColumns(badgeCount).map(columns => ({value: String(columns), label: `${columns} × ${badgeCount / columns}`}))]} onChange={value => change("badgeColumns", value === "auto" ? "auto" : Number(value))}/> : <p className="builder-note">{t("Ce jeu n’utilise pas de badges.")}</p>}</div>
    </section>
    <section className="composition-section"><h3><Camera size={15}/>{t("Autres éléments")}</h3>
      <div className="composition-control"><Toggle label="Caméra" checked={options.camera} onChange={value => change("camera", value)}/>{options.camera && <ChoiceGroup label={t("Format de la caméra")} value={options.cameraRatio === 4 / 3 ? "4:3" : "16:9"} columns={2} options={[{value: "16:9", label: "16:9"}, {value: "4:3", label: "4:3"}]} onChange={value => change("cameraRatio", value === "4:3" ? 4 / 3 : 16 / 9)}/>}</div>
      <Toggle label="Chat" checked={options.chat} onChange={value => change("chat", value)}/><Toggle label="Compteur Nuzlocke" checked={options.counter} onChange={value => change("counter", value)}/>
    </section>
  </div>;
}
function CompositionDialog({data, scene, themes, onApply, onClose}: Props & {onClose: () => void}) {
  const {t, locale} = useI18n(), [options, setOptions] = useState(() => initialOptions(data, scene)), [selected, setSelected] = useState(0);
  const sample = useMemo(() => scene ?? demoScene(), [scene]), badgeCount = GAMES[sample.game].badges.length;
  const effective = useMemo(() => ({...options, badges: options.badges && badgeCount > 0, badgeCount, badgeColumns: typeof options.badgeColumns === "number" && !compositionBadgeColumns(badgeCount).includes(options.badgeColumns) ? "auto" as const : options.badgeColumns}), [options, badgeCount]);
  const measureScene = useMemo(() => ({...sample, nuzlocke: true}), [sample]);
  const measurementKey = JSON.stringify([sample.style, sample.game, data.theme, data.useStudioStyle, themes, effective.teamLayout, badgeCount, locale]);
  const [measures, setMeasures] = useState<{key: string; bounds: Record<string, ContentBounds>}>({key: "", bounds: {}});
  const report = useCallback<BoundsReporter>((id, next) => {
    setMeasures(previous => {
      const bounds = previous.key === measurementKey ? previous.bounds : {}, old = bounds[id];
      return old && old.width === next.width && old.height === next.height ? previous : {key: measurementKey, bounds: {...bounds, [id]: next}};
    });
  }, [measurementKey]);
  const measured = useMemo<CompositionMeasurements>(() => {
    if (measures.key !== measurementKey) return {};
    return {team: measures.bounds.team, counter: measures.bounds.counter, badges: Object.fromEntries(compositionBadgeColumns(badgeCount).map(cols => [cols, measures.bounds["badges-" + cols]]))};
  }, [measures, measurementKey, badgeCount]);
  const requiredBadgeColumns = typeof effective.badgeColumns === "number" ? [effective.badgeColumns] : compositionBadgeColumns(badgeCount);
  const ready = (!effective.team || !!measured.team) && (!effective.counter || !!measured.counter) && (!effective.badges || requiredBadgeColumns.every(cols => !!measured.badges?.[cols]));
  const {proposals, pending, error} = useProposals(effective, measured, ready);
  const proposal = proposals[Math.min(selected, proposals.length - 1)];
  const [bases] = useState(() => Object.fromEntries(Object.entries(names).map(([role, name]) => [role, newElement(role === "main" || role === "secondary" ? "game-screen" : role === "counter" ? "nuzlocke" : role as "camera" | "chat" | "team" | "badges", name)])));
  const generated = useMemo(() => ({...data, elements: proposal?.placements.map((p, zIndex): BuilderElement => {
    let element = {...bases[p.role], name: t(p.role === "main" && !["ds", "3ds"].includes(effective.console) ? "Écran de jeu" : names[p.role]), x: p.x, y: p.y, width: p.width, height: p.height, zIndex};
    if (external(element)) element = {...element, properties: {...element.properties, ...(p.platform ? {platform: p.platform} : {}), screen: p.screen ?? "top"}};
    if (element.type === "team") element = {...element, properties: {layout: effective.teamLayout, scale: p.width / (measured.team?.width || p.width)}};
    if (element.type === "badges") element = {...element, properties: {columns: p.columns, scale: p.width / (measured.badges?.[p.columns ?? 1]?.width || p.width)}};
    if (element.type === "nuzlocke") element = {...element, properties: {scale: p.width / (measured.counter?.width || p.width)}};
    return element;
  }) ?? []}), [data, proposal, bases, t, effective.console, effective.teamLayout, measured]);
  const previewScene = useMemo(() => effective.counter ? {...sample, nuzlocke: true} : sample, [sample, effective.counter]);
  const updateOptions: Dispatch<SetStateAction<CompositionOptions>> = action => {setSelected(0);setOptions(action);};
  const main = proposal?.placements.find(p => p.role === "main"), emptyTeam = effective.team && measured.team && !measured.team.width;
  return <>
    <div className="composition-grid">
      <CompositionControls options={{...options, badgeColumns: effective.badgeColumns}} setOptions={updateOptions} badgeCount={badgeCount}/>
      <div className="composition-review" aria-busy={pending}>
        <div className="composition-review-heading"><strong>{t("Ta composition")}</strong><span>1920 × 1080</span></div>
        <div className="composition-preview-wrap"><CompositionPreview data={generated} scene={previewScene} themes={themes}/>{pending && <div className="composition-loading" role="status"><LoaderCircle size={20}/>{t("Recherche d’une disposition…")}</div>}</div>
        {!!proposals.length && <div className="composition-proposals" role="group" aria-label={t("Propositions de disposition")}>{proposals.map((candidate, index) => <button type="button" key={index} aria-pressed={Math.min(selected, proposals.length - 1) === index} disabled={pending} onClick={() => setSelected(index)}><LayoutThumbnail proposal={candidate}/><span>{t("Proposition {number}", {number: index + 1})}</span>{Math.min(selected, proposals.length - 1) === index && <Check size={14}/>}</button>)}</div>}
        {main && <p className="composition-summary"><Monitor size={14}/>{t("Écran de jeu")} · {Math.round(main.width)} × {Math.round(main.height)}{effective.team && <><span>·</span>{t("Équipe")} {effective.teamLayout?.replace("x", " × ")}</>}</p>}
        {proposal?.compact && <p className="composition-hint">{t("L’équipe est compacte. Retire un élément ou choisis une autre grille pour l’agrandir.")}</p>}
        {effective.counter && !sample.nuzlocke && <p className="composition-hint">{t("Le compteur s’affiche quand le mode Nuzlocke est actif dans l’aventure.")}</p>}
        {emptyTeam && <p className="obs-integration-error" role="alert">{t("L’équipe est masquée dans le style de l’aventure.")}</p>}
        {(error || ready && !pending && !proposals.length) && <p className="obs-integration-error" role="alert">{t("Aucune disposition lisible trouvée. Retire un élément ou change de grille.")}</p>}
        <p className="builder-note">{t("Les tailles tiennent compte du thème et des grilles choisies. Tout reste modifiable dans l’éditeur.")}</p>
        <p className="builder-note">{t("Après application, relie tes captures avec « Créer une scène OBS ».")}</p>
      </div>
    </div>
    <div className="composition-footer"><p className="builder-note">{data.elements.length ? t("La disposition actuelle sera remplacée. Tu peux annuler dans l’éditeur.") : t("La composition sera ajoutée comme brouillon.")}</p><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>{t("Annuler")}</button><button type="button" className="button primary" disabled={pending || !proposal || !!error || !!emptyTeam} onClick={() => {onApply(generated);onClose();}}>{t(data.elements.length ? "Remplacer la disposition" : "Appliquer la disposition")}</button></div></div>
    <MeasuredContent key={measurementKey} data={data} scene={measureScene} themes={themes} options={effective} onBounds={report}/>
  </>;
}
export function CompositionGenerator(props: Props) {
  const {t} = useI18n(), [open, setOpen] = useState(false);
  return <><button type="button" className="button secondary compact" onClick={() => setOpen(true)}><WandSparkles size={16}/>{t("Composition automatique")}</button><Modal open={open} onOpenChange={setOpen} title={t("Composition automatique")} description={t("Expérimental · Choisis tes grilles, puis compare les propositions.")} className="composition-modal" wide>{open && <CompositionDialog {...props} onClose={() => setOpen(false)}/>}</Modal></>;
}
