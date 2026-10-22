"use client";
import { pokemonName } from "@/i18n/pokemon";
import { useI18n } from "@/i18n/client";
import {ChoiceGroup} from "./choice-group";
import {GamePicker} from "./game-picker";
import {useEditorViewport} from "@/lib/use-editor-viewport";
import { ColorPicker } from "./color-picker";
import { THEMES, type StarterId } from "@/themes/catalog";
import { useCustomThemes } from "@/themes/custom/use-custom-themes";
import { resolveCustomTheme } from "@/themes/custom/resolve";
import type { CustomTheme } from "@/themes/custom/schema";
import { ThemeLibrary } from "@/themes/theme-library";
import { ThemeSample } from "@/themes/theme-sample";
import { CustomThemeSample } from "@/themes/custom/sample";
import { useThemeFavorites } from "@/themes/use-theme-favorites";
import { OverlaySizeSettings } from "./overlay-size-settings";
import {spriteCopy} from "@/local/sprites/copy";
import { SpriteSelector } from "./sprite-selector";
import { premiumGrade, availableTheme } from "@/lib/premium";
import type { Grade } from "@/lib/access";
import { useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Expand,
  Eye,
  LoaderCircle,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  Settings2,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Undo2,
} from "lucide-react";
import { Confirm, Modal, Toggle } from "./ui";
import { PokemonImage } from "./pokemon-image";
import { OverlayStage, type OverlayDimensions } from "./overlay-stage";
import { TeamPreviewToggle } from "./team-preview-toggle";
import { ShareCreation } from "./share-creation";
import { useConnect, type Device } from "@/lib/use-connect";
import "@/app/connect/connect.css";
import { useScene } from "@/lib/use-scene";
import { useStudioPreviewHeight } from "@/lib/use-studio-preview-height";
import { GAMES } from "@/lib/games";
import {
  TYPE_LABELS,
  type Pokemon,
  type Scene,
  type SceneData,
} from "@/lib/model";
import { demoScene, withDemoTeam } from "@/lib/demo";
const PokemonPicker = dynamic(() =>
  import("./pokemon-picker").then((m) => m.PokemonPicker),
);
const PokemonEditor = dynamic(() =>
  import("./pokemon-editor").then((m) => m.PokemonEditor),
);
const accents = [
  "#ef3340",
  "#ff7043",
  "#fbbf24",
  "#4ade80",
  "#38bdf8",
  "#a78bfa",
];

export function Studio({
  initialData,
  initialDevice,
  scene,
  demo = false,
  grade,
  initialStarter = null,
  initialCustomThemes = [],
}: {
  initialData: SceneData;
  initialDevice?: Device | null;
  scene?: Scene;
  demo?: boolean;
  grade?: Grade;
  initialStarter?: StarterId | null;
  initialCustomThemes?: CustomTheme[];
}) {
  const { t: tr, locale } = useI18n();
  useEditorViewport("studio");
  const [themeBrowserOpen, setThemeBrowserOpen] = useState(false);
  const [styleSection,setStyleSection]=useState<"theme"|"team"|"badges"|"deaths">("theme");
  const starter = initialStarter;
  const {
    data: manualData,
    record,
    status,
    error,
    update,
    undo,
    undoCount,
    save,
    settings,
  } = useScene(initialData, scene, demo, premiumGrade(grade), starter);
  const connect = useConnect(scene?.id, manualData, initialDevice);
  const premium = premiumGrade(grade);
  const customLibrary = useCustomThemes(initialCustomThemes, !demo);
  const data = resolveCustomTheme(
    availableTheme(connect.data, premium, starter),
    customLibrary.themes,
  );
  const { contentRef, maxHeight: previewMaxHeight } = useStudioPreviewHeight();
  const [tab, setTab] = useState<"team" | "style" | "obs">("team");
  const themeFavorites = useThemeFavorites(tab === "style", demo);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [previewTeam, setPreviewTeam] = useState(false);
  const previewData = previewTeam ? withDemoTeam(data) : data;
  const [guide, setGuide] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [background, setBackground] = useState("grid");
  const [toast, setToast] = useState("");
  const [part, setPart] = useState("all");
  const [dimensions, setDimensions] = useState<OverlayDimensions | null>(null);
  const previewPart = tab === "obs" ? part : "all";
  const recommended = dimensions?.part === previewPart ? dimensions : null;
  const previewTitle = previewPart.startsWith("slot-")
    ? tr("Emplacement ") + previewPart.slice(5)
    : ({
        all: tr("Profil complet"),
        team: tr("Équipe seule"),
        badges: tr("Badges seuls"),
        deaths: tr("Compteur Nuzlocke"),
      }[previewPart] ?? tr("Profil complet"));
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(data.name);
  const game = GAMES[data.game];
  const count = data.team.filter(Boolean).length;
  const sourcePath = `/overlay/${record?.view_token || "demo"}?lang=${locale}${part === "all" ? "" : `&part=${part}`}`;
  const patch = (p: Partial<SceneData>) => update((d) => ({ ...d, ...p }));
  const setStyle = (p: Partial<SceneData["style"]>) =>
    update((d) => ({
      ...d,
      style: {
        ...d.style,
        ...p,
        ...(p.theme && p.theme !== "custom"
          ? {
              customThemeId: undefined,
              customTheme: undefined,
              customAccent: undefined,
            }
          : {}),
        ...(d.style.theme === "custom" && p.accent && !p.theme
          ? { customAccent: p.accent }
          : {}),
      },
    }));
  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  }
  function changePokemon(i: number, pokemon: Pokemon | null) {
    update((d) => ({
      ...d,
      team: d.team.map((p, index) => (index === i ? pokemon : p)),
    }));
  }
  async function copySource() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${sourcePath}`,
      );
      notify(tr("Lien OBS copié"));
    } catch {
      notify(tr("Copie le lien depuis l’onglet OBS."));
    }
  }
  function exportScene() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/[^a-z0-9-]/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(tr("Profil exporté"));
  }
  return (
    <div className="studio-shell">
      
      <div className="studio-main">
        <header className="studio-header">
          <div className="breadcrumbs">
            <Link href={demo ? "/" : "/studio"}>{tr("Mes profils")}</Link>
            <ChevronRight size={14} />
            <span>{data.name}</span>
            {demo && <span className="demo-badge">{tr("DÉMO")}</span>}
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => setGuide(true)}
              title={tr("Installation OBS")}
              aria-label={tr("Installation OBS")}
            >
              <CircleHelp size={18} />
            </button>
            <span className={`save-state status-${status}`} aria-live="polite">
              {status === "saving" ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Check size={14} />
              )}
              {status === "local"
                ? tr("Démo locale")
                : status === "saved"
                  ? tr("Enregistré")
                  : status === "saving"
                    ? tr("Enregistrement…")
                    : tr("Non enregistré")}
            </span>
            {demo ? (
              <Link href="/login" className="button primary compact">
                {tr("Enregistrer la démo ")}
                <ArrowUpRight size={16} />
              </Link>
            ) : (
              <button
                className="button primary compact"
                onClick={() => {
                  setTab("obs");
                  void copySource();
                }}
              >
                <Copy size={16} />
                {tr("Lien OBS")}
              </button>
            )}
          </div>
        </header>
        <main className="studio-workspace">
          <div className="workspace-title">
            <div>
              <button
                className="title-button"
                onClick={() => {
                  setNameDraft(data.name);
                  setRenaming(true);
                }}
                title={tr("Renommer le profil")}
              >
                <h1>{data.name}</h1>
                <Settings2 size={18} />
              </button>
              <div className="adventure-meta">
                <span>{tr(game.region)}</span>
                <span className="meta-divider" />
                {data.nuzlocke ? (
                  <span>
                    <Swords size={13} />
                    Nuzlocke
                  </span>
                ) : (
                  <span>{tr("Classique")}</span>
                )}
              </div>
            </div>
            <div className="workspace-tools">
              {!demo && record && <ShareCreation kind="profile" sourceId={record.id}
                version={record.version} name={data.name} disabled={status !== "saved"} compact />}
              <button
                className="icon-button"
                disabled={!undoCount}
                onClick={undo}
                title={tr("Annuler la dernière modification")}
                aria-label={tr("Annuler la dernière modification")}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-button"
                onClick={exportScene}
                title={tr("Exporter le profil")}
                aria-label={tr("Exporter le profil")}
              >
                <Download size={18} />
              </button>
            </div>
          </div>
          {connect.revoked && (
            <div className="error-banner" role="status">
              <span>{tr("Connect a changé de profil ou a été dissocié.")}</span>
              <button onClick={() => window.location.reload()}>
                {tr("Recharger")}
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{tr(error)}</span>
              <button onClick={() => void save()}>{tr("Réessayer")}</button>
              <button onClick={() => window.location.reload()}>
                {tr("Recharger")}
              </button>
            </div>
          )}
          <div className="workspace-grid">
            <div className="workspace-content" ref={contentRef}>
              <section className="preview-panel">
                <div className="panel-heading">
                  <h2>
                    <Eye size={16} />
                    {tr("Aperçu · ")}
                    {previewTitle}
                  </h2>
                  <div className="preview-actions">
                    <TeamPreviewToggle checked={previewTeam} onChange={setPreviewTeam} />
                    <div
                      className="background-options"
                      role="group"
                      aria-label={tr("Fond de l’aperçu")}
                    >
                      {["grid", "dark", "light"].map((bg) => (
                        <button
                          key={bg}
                          className={`background-swatch bg-${bg} ${background === bg ? "selected" : ""}`}
                          title={tr(
                            bg === "grid"
                              ? "Fond transparent"
                              : bg === "dark"
                                ? "Fond sombre"
                                : "Fond clair",
                          )}
                          aria-label={tr(
                            bg === "grid"
                              ? "Fond transparent"
                              : bg === "dark"
                                ? "Fond sombre"
                                : "Fond clair",
                          )}
                          aria-pressed={background === bg}
                          onClick={() => setBackground(bg)}
                        />
                      ))}
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setExpanded(true)}
                      aria-label={tr("Agrandir l’aperçu")}
                    >
                      <Expand size={16} />
                    </button>
                  </div>
                </div>
                <div className={`preview-canvas bg-${background}`}>
                  <div className="canvas-marker">{tr(previewTeam ? "Démo · aperçu uniquement" : "SOURCE NAVIGATEUR")}</div>
                  <OverlayStage
                    data={previewData}
                    part={previewPart}
                    maxHeight={previewMaxHeight}
                    onDimensions={setDimensions}
                  />
                  {!previewTeam && count === 0 &&
                    (previewPart === "all" || previewPart === "team") &&
                    recommended?.width === 0 && (
                      <button
                        className="empty-preview"
                        onClick={() => !connect.device && setPickerSlot(0)}
                      >
                        <Plus size={24} />
                        <span>{tr("Ajoute ton premier Pokémon")}</span>
                      </button>
                    )}
                  <div className="canvas-footer">
                    <span>
                      {recommended && recommended.width > 0
                        ? tr("OBS recommandé : ") +
                          recommended.width +
                          " × " +
                          recommended.height +
                          " px"
                        : recommended
                          ? tr("Source vide")
                          : tr("Calcul des dimensions…")}
                    </span>
                    <span>{tr("Fond transparent dans OBS")}</span>
                  </div>
                </div>
              </section>
              <div
                className="workspace-editor"
                role="region"
                aria-label={tr("Équipe et badges")}
                tabIndex={0}
              >
                <section className="team-section">
                  <div className="section-heading">
                    <h2>
                      {tr("Équipe ")}
                      <span>{count}/6</span>
                    </h2>
                    <span className="muted small">
                      {tr("Clique pour modifier")}
                    </span>
                  </div>
                  <div className="team-grid" aria-disabled={!!connect.device}>
                    {data.team.map((p, i) => (
                      <button
                        key={i}
                        className={`team-card ${!p ? "empty-card" : ""} ${p?.fainted ? "fainted" : ""}`}
                        disabled={!!connect.device}
                        onClick={() => (p ? setEditSlot(i) : setPickerSlot(i))}
                        aria-label={
                          p
                            ? tr("Modifier {name}, emplacement {slot}", {
                                name: pokemonName(p, locale),
                                slot: i + 1,
                              })
                            : tr("Ajouter un Pokémon, emplacement {slot}", {
                                slot: i + 1,
                              })
                        }
                        style={
                          {
                            "--type-glow": p
                              ? `var(--type-${p.types[0]})`
                              : "transparent",
                          } as CSSProperties
                        }
                      >
                        <span className="slot-number">0{i + 1}</span>
                        {p ? (
                          <>
                            {!p.isEgg && p.shiny && (
                              <Sparkles size={14} className="team-shiny" />
                            )}
                            <PokemonImage
                              pokemon={p}
                              size={150}
                              style={data.style.sprite}
                              fallbackStyle="home"
                              variant={data.style.spriteVariant}
                            />
                            <strong>{pokemonName(p, locale)}</strong>
                            {!p.isEgg && (
                              <div className="team-card-bottom">
                                <span>
                                  {tr("N. ")}
                                  {p.level}
                                </span>
                                <div>
                                  {p.types.map((t) => (
                                    <span
                                      className={`type-dot type-${t}`}
                                      title={tr(TYPE_LABELS[t])}
                                      key={t}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="add-slot">
                            <span>
                              <Plus size={24} />
                            </span>
                            <strong>{tr("Ajouter")}</strong>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="progress-panel">
                  <div className="section-heading">
                    <h2>
                      <Shield size={17} />
                      {tr("Badges")}{" "}
                      <span>
                        {
                          data.badges.filter((i) => i < game.badges.length)
                            .length
                        }
                        /{game.badges.length}
                      </span>
                    </h2>
                    <span className="muted small">
                      {connect.automatedBadges
                        ? tr("Synchronisés par Connect")
                        : game.region}
                    </span>
                  </div>
                  <div
                    className={`badges-grid ${game.badges.length > 8 ? "many-badges" : ""}`}
                  >
                    {game.badges.map((badge, i) => (
                      <button
                        className={`badge-button ${data.badges.includes(i) ? "earned" : ""}`}
                        key={badge.image}
                        aria-label={`${tr(badge.name)} : ${tr(data.badges.includes(i) ? "obtenu" : "non obtenu")}`}
                        aria-pressed={data.badges.includes(i)}
                        disabled={connect.automatedBadges}
                        onClick={() =>
                          patch({
                            badges: data.badges.includes(i)
                              ? data.badges.filter((b) => b !== i)
                              : [...data.badges, i],
                          })
                        }
                      >
                        <Image
                          unoptimized
                          src={badge.image}
                          alt=""
                          width={46}
                          height={46}
                        />
                        <span>{tr(badge.name)}</span>
                        {data.badges.includes(i) && (
                          <Check size={11} className="badge-check" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
            <aside
              className="inspector"
              aria-label={tr("Réglages du profil")}
            >
              <div
                className="inspector-tabs"
                role="tablist"
                aria-label={tr("Réglages du studio")}
              >
                {(
                  [
                    { id: "team", icon: Swords, label: tr("Profil") },
                    { id: "style", icon: Palette, label: "Style" },
                    { id: "obs", icon: Monitor, label: "OBS" },
                  ] as const
                ).map(({ id, icon: Icon, label }) => (
                  <button
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls={`panel-${id}`}
                    id={`tab-${id}`}
                    key={id}
                    className={tab === id ? "active" : ""}
                    onClick={() => setTab(id)}
                  >
                    <Icon size={17} />
                    {tr(label)}
                  </button>
                ))}
              </div>
              <div
                className="inspector-content"
                key={tab}
                tabIndex={0}
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
              >
                {tab === "team" && (
                  <>
                    <div className="inspector-section">
                      <h3>{tr("Profil")}</h3>
                      <label className="field">
                        {tr("Jeu")}
                        <GamePicker value={data.game} disabled={!!connect.device} onChange={game=>patch({game,badges:[]})}/>
                      </label>
                      <div className="game-note">
                        <Shield size={15} />
                        {game.region}
                        <span>
                          {game.badges.length} {tr("badges")}
                        </span>
                      </div>
                    </div>
                    <div className="inspector-section">
                      <Toggle
                        label={tr("Mode Nuzlocke")}
                        checked={data.nuzlocke}
                        onChange={(v) => patch({ nuzlocke: v })}
                      />
                      {data.nuzlocke && (
                        <div className="death-counter">
                          <div>
                            <Skull size={19} />
                            <span>
                              {connect.automatedDeaths
                                ? tr("Morts · Connect")
                                : tr("Pokémon perdus")}
                            </span>
                          </div>
                          <div className="counter-control">
                            <button
                              className="icon-button"
                              disabled={
                                connect.automatedDeaths || data.deaths === 0
                              }
                              onClick={() =>
                                patch({ deaths: Math.max(0, data.deaths - 1) })
                              }
                              aria-label={tr("Réduire le compteur de morts")}
                            >
                              −
                            </button>
                            <strong>{data.deaths}</strong>
                            <button
                              className="icon-button"
                              disabled={
                                connect.automatedDeaths || data.deaths === 9999
                              }
                              onClick={() => patch({ deaths: data.deaths + 1 })}
                              aria-label={tr("Augmenter le compteur de morts")}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {data.nuzlocke && connect.automatedDeaths && (
                      <p className="muted small">
                        {tr("Correction et remise à zéro dans Connect.")}
                      </p>
                    )}
                    <div className="inspector-section">
                      <h3>{tr("Affichage rapide")}</h3>
                      <Toggle
                        label={tr("Noms")}
                        checked={data.style.showNames}
                        onChange={(v) => setStyle({ showNames: v })}
                      />
                      <Toggle
                        label={tr("Niveaux")}
                        checked={data.style.showLevels}
                        onChange={(v) => setStyle({ showLevels: v })}
                      />
                      <Toggle
                        label="Badges"
                        checked={data.style.showBadges}
                        onChange={(v) => setStyle({ showBadges: v })}
                      />
                    </div>
                    <button
                      className="inspector-link"
                      onClick={() => setTab("style")}
                    >
                      <Palette size={16} />
                      {tr("Personnaliser le style")}
                      <ChevronRight size={16} />
                    </button>
                    {demo && (
                      <button
                        className="inspector-link muted"
                        onClick={() => {
                          update(demoScene());
                          notify(tr("Démo réinitialisée"));
                        }}
                      >
                        <RotateCcw size={15} />
                        {tr("Réinitialiser la démo")}
                      </button>
                    )}
                  </>
                )}
                {tab === "style" && (
                  <>
                    <div className="app-section-tabs studio-style-tabs" role="group" aria-label={tr("Réglages du style")}>{([["theme","Thème"],["team","Équipe"],["badges","Badges"],["deaths","Compteur"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={styleSection===value} onClick={()=>setStyleSection(value)}>{tr(label)}</button>)}</div>
                    {styleSection==="theme"&&<>
                    <div className="inspector-section">
                      <h3>{tr("Thème")}</h3>
                      {starter && (
                        <p className="starter-note">
                          {tr("Starter :")} {tr(THEMES[starter].label)}
                        </p>
                      )}
                      <button type="button" className="theme-current-trigger" aria-haspopup="dialog" aria-expanded={themeBrowserOpen} onClick={()=>setThemeBrowserOpen(true)}>
                        <span className="theme-current-preview">{data.style.theme==="custom"&&data.style.customTheme?<CustomThemeSample config={data.style.customTheme}/>:<ThemeSample theme={data.style.theme}/>}</span>
                        <span className="theme-current-label"><small>{tr("Thème actuel")}</small><strong>{data.style.theme==="custom"?customLibrary.themes.find(theme=>theme.id===data.style.customThemeId)?.name||tr("Mes thèmes"):tr(THEMES[data.style.theme].label)}</strong><span>{tr("Changer de thème")}</span></span><ChevronRight size={18}/>
                      </button>
                      {customLibrary.error&&<p role="alert" className="theme-library-error">{tr(customLibrary.error)}</p>}
                      <Link href="/theme-creator" className="theme-create-action"><span className="theme-create-icon"><Plus size={19}/></span><span><strong>{tr("Créer un thème")}</strong><small>{tr("Couleurs, cartes et détails à ton image.")}</small></span><ChevronRight size={16}/></Link>
                      <Modal open={themeBrowserOpen} onOpenChange={setThemeBrowserOpen} title={tr("Choisir un thème")} className="theme-browser-modal" wide>
                        {themeBrowserOpen&&<>
<ThemeLibrary
                        selected={data.style.theme}
                        spriteLocked={data.style.spriteLocked}
                        customThemes={customLibrary.themes}
                        selectedCustomId={data.style.customThemeId}
                        onSelectCustom={(theme) =>
                          {setThemeBrowserOpen(false);setStyle({
                            theme: "custom",
                            customThemeId: theme.id,
                            customTheme: undefined,
                            customAccent: undefined,
                            accent: theme.config.accent,
                            ...(!data.style.spriteLocked?{sprite: theme.config.sprite,spriteVariant: theme.config.spriteVariant}:{}),
                          });}
                        }
                        starter={starter}
                        premium={premium}
                        demo={demo}
                        favorites={themeFavorites}
                        onMessage={notify}
                        onSelect={(theme) => {
                          setThemeBrowserOpen(false);
                          const definition = THEMES[theme];
                          setStyle({
                            theme,
                            ...(definition.defaultAccent
                              ? { accent: definition.defaultAccent }
                              : {}),
                            ...(!data.style.spriteLocked && definition.defaultSprite
                              ? {
                                  sprite: definition.defaultSprite,
                                  spriteVariant:
                                    definition.defaultVariant ?? "default",
                                }
                              : {}),
                          });
                        }}
                      />
                        <div className="theme-browser-footer"><Link href="/theme-creator" className="button secondary"><Plus size={16}/>{tr("Créer un thème")}</Link><button type="button" className="button secondary" onClick={()=>setThemeBrowserOpen(false)}>{tr("Fermer")}</button></div>
                        </>}
                      </Modal>
                    </div>
                    <div className="inspector-section">
                      <h3>{tr("Couleur d’accent")}</h3>
                      {data.style.theme === "custom" &&
                        data.style.customAccent && (
                          <button
                            type="button"
                            className="theme-upgrade"
                            onClick={() =>
                              setStyle({ customAccent: undefined })
                            }
                          >
                            <RotateCcw size={13} />
                            {tr("Couleur du thème")}
                          </button>
                        )}
                      <div className="accent-options">
                        {accents.map((accent) => (
                          <button
                            key={accent}
                            aria-label={`Accent ${accent}`}
                            aria-pressed={data.style.accent === accent}
                            className={
                              data.style.accent === accent ? "selected" : ""
                            }
                            style={{ background: accent }}
                            onClick={() => setStyle({ accent })}
                          >
                            {data.style.accent === accent && (
                              <Check size={16} />
                            )}
                          </button>
                        ))}
                        <ColorPicker
                          className="custom-color"
                          label="Couleur personnalisée"
                          value={data.style.accent}
                          onChange={(accent) => setStyle({ accent })}
                        />
                      </div>
                    </div>
                    <div className="inspector-section">
                      {data.style.showSprites !== false && (
                        <><SpriteSelector
                          style={data.style}
                          onChange={setStyle}
                        />
                        <Toggle label={spriteCopy[locale].locked} checked={!!data.style.spriteLocked} onChange={value=>setStyle({spriteLocked:value})}/>
                        <p className="sprite-lock-note">{spriteCopy[locale].lockNote}</p></>
                      )}
                    </div>
                    </>}
                    {styleSection!=="theme"&&<OverlaySizeSettings
                      section={styleSection}
                      style={data.style}
                      nuzlocke={data.nuzlocke}
                      badgeCount={game.badges.length}
                      onChange={setStyle}
                    />}
                  </>
                )}
                {tab === "obs" && (
                  <>
                    <div className="inspector-section">
                      <h3>{tr("Source navigateur")}</h3>
                      <label className="field">
                        {tr("Contenu")}
<ChoiceGroup label={tr("Contenu")} value={part.startsWith("slot-")?"slots":part} columns={2} onChange={value=>setPart(value==="slots"?"slot-1":value)} options={[{value:"all",label:tr("Profil complet")},{value:"team",label:tr("Équipe seule")},{value:"badges",label:tr("Badges seuls")},{value:"deaths",label:"Nuzlocke"},{value:"slots",label:tr("Pokémon individuel")}]} />
                        {part.startsWith("slot-")&&<div className="source-slot-choices"><span>{tr("Emplacement")}</span><ChoiceGroup label={tr("Emplacement")} value={part} columns={6} onChange={setPart} options={data.team.map((p,i)=>({value:"slot-"+(i+1),label:String(i+1),title:p?pokemonName({...p,nickname:""},locale):tr("Emplacement vide.")}))}/></div>}
                      </label>
                      {demo ? (
                        <div className="demo-obs">
                          <Monitor size={27} />
                          <p>{tr("Connecte-toi pour diffuser dans OBS.")}</p>
                          <Link href="/login" className="button primary">
                            {tr("Se connecter")}
                          </Link>
                        </div>
                      ) : (
                        <>
                          <button
                            className="button primary full-width"
                            onClick={() => void copySource()}
                          >
                            <Copy size={16} />
                            {tr("Copier le lien OBS")}
                          </button>
                          <a
                            className="button secondary full-width"
                            href={sourcePath}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {tr("Ouvrir la source")}
                            <ArrowUpRight size={16} />
                          </a>
                        </>
                      )}
                      <section
                        className="obs-recommendation"
                        aria-label={tr("Dimensions recommandées pour OBS")}
                      >
                        <h4>{tr("Dimensions recommandées OBS")}</h4>
                        {recommended && recommended.width > 0 ? (
                          <>
                            <div className="obs-dimensions">
                              <div>
                                <span>{tr("Largeur")}</span>
                                <strong>{recommended.width}</strong>
                              </div>
                              <div>
                                <span>{tr("Hauteur")}</span>
                                <strong>{recommended.height}</strong>
                              </div>
                            </div>
                            <p className="muted small">
                              {tr(part === "all" || part === "team" ? "Équipe calculée sur 6 emplacements." : "En pixels, selon le contenu actuel.")}
                            </p>
                          </>
                        ) : (
                          <p className="obs-empty-source">
                            {!recommended
                              ? tr("Calcul des dimensions…")
                              : previewPart.startsWith("slot-")
                                ? tr("Emplacement vide.")
                                : previewPart === "deaths" && !data.nuzlocke
                                  ? tr("Compteur Nuzlocke désactivé.")
                                  : tr("Aucun élément affiché.")}
                          </p>
                        )}
                      </section>
                      {!demo && (
                        <>
                          <Toggle
                            label={tr("Diffusion activée")}
                            checked={record?.enabled ?? true}
                            onChange={(enabled) => void settings({ enabled })}
                            disabled={status === "saving"}
                          />
                          <span className="muted small">
                            {tr("Actualisation toutes les 2 secondes.")}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      className="inspector-link"
                      onClick={() => setGuide(true)}
                    >
                      <CircleHelp size={16} />
                      {tr("Installer dans OBS")}
                      <ChevronRight size={16} />
                    </button>
                    {!demo && (
                      <button
                        className="inspector-link muted"
                        onClick={() => setConfirmRotate(true)}
                      >
                        <RotateCcw size={15} />
                        {tr("Renouveler le lien")}
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="inspector-footer">
                <Image src="/logo/pokestream-logo-no-stand.svg" width={24} height={12} alt="" unoptimized />
                <span>PokeStream</span>
              </div>
            </aside>
          </div>
        </main>
        <footer className="studio-footer">
          <span>POKESTREAM STUDIO</span>
          <Link href="/privacy">{tr("Confidentialité")}</Link>
          <span>{tr("Projet fan indépendant")}</span>
        </footer>
      </div>
      {pickerSlot !== null && (
        <PokemonPicker
          spriteStyle={data.style.sprite}
          spriteVariant={data.style.spriteVariant}
          open
          onClose={() => setPickerSlot(null)}
          onSelect={(p) => changePokemon(pickerSlot, p)}
        />
      )}
      {editSlot !== null && data.team[editSlot] && (
        <PokemonEditor
          key={`${editSlot}-${data.team[editSlot]!.pokemonId}-${Boolean(data.team[editSlot]!.isEgg)}`}
          spriteStyle={data.style.sprite}
          spriteVariant={data.style.spriteVariant}
          pokemon={data.team[editSlot]!}
          slot={editSlot}
          onClose={() => setEditSlot(null)}
          onSave={(p) => changePokemon(editSlot, p)}
          onRemove={() => changePokemon(editSlot, null)}
          onReplace={() => {
            setPickerSlot(editSlot);
            setEditSlot(null);
          }}
          onMove={(direction, draft) => {
            const target = editSlot + direction;
            update((d) => {
              const team = [...d.team];
              team[editSlot] = draft;
              [team[editSlot], team[target]] = [team[target], team[editSlot]];
              return { ...d, team };
            });
            setEditSlot(target);
          }}
        />
      )}
      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title={tr("Aperçu du profil")}
        wide
      >
        <div className={`expanded-preview bg-${background}`}>
          <OverlayStage data={previewData} part={previewPart} maxHeight={560} />
        </div>
      </Modal>
      <Modal open={guide} onOpenChange={setGuide} title={tr("Prêt pour OBS")}>
        <ol className="obs-steps">
          <li>
            <span>1</span>
            <div>
              <strong>{tr("Copie ton lien")}</strong>
              <p>{tr("Onglet OBS → Copier le lien OBS.")}</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>{tr("Ajoute une source navigateur")}</strong>
              <p>{tr("OBS → Sources → + → Navigateur.")}</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>{tr("Colle le lien")}</strong>
              <p>
                {tr(
                  "Reporte les dimensions recommandées de l’onglet OBS. Le fond est transparent.",
                )}
              </p>
            </div>
          </li>
        </ol>
        <p className="muted small">
          {tr(
            "Les modifications enregistrées apparaissent automatiquement. Le lien permet uniquement de lire l’overlay.",
          )}
        </p>
        <button
          className="button primary full-width"
          onClick={() => {
            setGuide(false);
            setTab("obs");
          }}
        >
          {tr("Accéder à mon lien")}
          <ChevronRight size={16} />
        </button>
      </Modal>
      <Modal
        open={renaming}
        onOpenChange={setRenaming}
        title={tr("Renommer le profil")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nameDraft.trim()) {
              patch({ name: nameDraft.trim() });
              setRenaming(false);
            }
          }}
        >
          <label className="field">
            {tr("Nom")}
            <input
              autoFocus
              required
              value={nameDraft}
              maxLength={48}
              onChange={(e) => setNameDraft(e.target.value)}
            />
          </label>
          <button className="button primary full-width">
            {tr("Enregistrer")}
          </button>
        </form>
      </Modal>
      <Confirm
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={tr("Renouveler le lien OBS ?")}
        description={tr(
          "L’ancien lien cessera de fonctionner. Remplace-le ensuite dans OBS.",
        )}
        action={tr("Renouveler")}
        onConfirm={() => void settings({ rotateToken: true })}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {tr(toast)}
        </div>
      )}
    </div>
  );
}
