"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Layers,
  LockKeyhole,
  Unlock,
  Monitor,
  Camera,
  MessageSquare,
  ImagePlus,
  Type,
  Skull,
  Shield,
  Users,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Magnet,
  ZoomIn,
  ZoomOut,
  Settings2,
  Download,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { authFetch } from "@/local/client";
import { demoScene, withDemoTeam } from "@/lib/demo";
import type { SceneData } from "@/lib/model";
import { TeamPreviewToggle } from "@/components/team-preview-toggle";
import { Select, SelectOption } from "@/components/select";
import {
  ELEMENT_TYPES,
  ELEMENT_LABELS,
  newElement,
  isDynamic,
  type BuilderRecord,
  type BuilderElement,
  type BuilderAsset,
  type ElementType,
} from "./schema";
import { fitDynamicElement, useBuilderGeometry } from "./geometry";
import { snapResize, snapTargets } from "./snapping";
import { BuilderCanvas, elementStyle } from "./render";
import { Inspector, type BuilderContext } from "./inspector";
import { useBuilderDocument } from "./use-document";
import { exportBuilderPNG } from "./export";
const icons = {
  "game-screen": Monitor,
  team: Users,
  badges: Shield,
  nuzlocke: Skull,
  camera: Camera,
  chat: MessageSquare,
  image: ImagePlus,
  text: Type,
};
const handles = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
type Gesture = {
  id: string;
  startX: number;
  startY: number;
  element: BuilderElement;
  handle: readonly [number, number] | null;
};
export function BuilderEditor({
  initial,
  context,
  initialAssets,
}: {
  initial: BuilderRecord;
  context: BuilderContext;
  initialAssets: BuilderAsset[];
}) {
  const router = useRouter();
  const { t } = useI18n(),
    doc = useBuilderDocument(initial),
    { update } = doc;
  const geometry = useBuilderGeometry();
  const data = useMemo(
    () => ({
      ...doc.data,
      elements: doc.data.elements.map((e) =>
        fitDynamicElement(e, geometry.bounds[e.id]),
      ),
    }),
    [doc.data, geometry.bounds],
  );
  const [selected, setSelected] = useState<string | null>(null),
    [zoom, setZoom] = useState(0.5),
    [fit, setFit] = useState(true),
    [preview, setPreview] = useState(false),
    [demo, setDemo] = useState(false),
    [snap, setSnap] = useState(true),
    [scene, setScene] = useState<SceneData | null>(null),
    [assets, setAssets] = useState(initialAssets),
    [exporting, setExporting] = useState(false),
    [guides, setGuides] = useState<{ x?: number; y?: number }>({}),
    [liveError, setLiveError] = useState(false);
  const viewport = useRef<HTMLDivElement>(null),
    art = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null),
    canvas = useRef<HTMLDivElement>(null);
  const element = data.elements.find((e) => e.id === selected);
  useEffect(() => {
    const library = doc.assetLibrary;
    if (!library) return;
    queueMicrotask(() => setAssets((old) => {
      const existing = new Set(library.items.map((a) => a.id));
      const checked = new Set(library.checkedIds);
      // Keep uploads that completed after the save took its snapshot.
      return [
        ...old.filter((a) => !checked.has(a.id) && !existing.has(a.id)),
        ...library.items,
      ];
    }));
  }, [doc.assetLibrary]);
  const changeElement = useCallback(
    (next: BuilderElement, remember = true) =>
      update(
        (old) => ({
          ...old,
          elements: old.elements.map((e) => (e.id === next.id ? next : e)),
        }),
        remember,
      ),
    [update],
  );
  useEffect(() => {
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const r = await authFetch(
          "/api/builder/" +
            initial.id +
            "/preview?scene=" +
            (data.sceneId ?? "none"),
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(8000),
            ]),
          },
        );
        if (!r.ok) throw new Error();
        const p = await r.json();
        if (!stopped) {
          setScene((old) =>
            JSON.stringify(old) === JSON.stringify(p.scene) ? old : p.scene,
          );
          setLiveError(false);
        }
      } catch {
        if (!stopped) setLiveError(true);
      } finally {
        if (!stopped) timer = setTimeout(poll, 3000);
      }
    }
    queueMicrotask(() => { if (!stopped) setScene(null); });
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [initial.id, data.sceneId]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const resize = new ResizeObserver(() => {
      if (fit)
        setZoom(
          Math.max(
            0.12,
            Math.min(
              1,
              (node.clientWidth - 64) / 1920,
              (node.clientHeight - 64) / 1080,
            ),
          ),
        );
    });
    resize.observe(node);
    return () => resize.disconnect();
  }, [fit, preview]);
  const remove = () => {
    if (element && !element.locked) {
      update({
        ...data,
        elements: data.elements.filter((e) => e.id !== element.id),
      });
      setSelected(null);
    }
  };
  const duplicate = () => {
    if (!element || data.elements.length >= 60) return;
    const copy = {
      ...structuredClone(element),
      id: crypto.randomUUID(),
      name: (element.name + " · " + t("Copie")).slice(0, 60),
      x: Math.min(3840, element.x + 24),
      y: Math.min(2160, element.y + 24),
      locked: false,
      zIndex: data.elements.length,
    };
    update({
      ...data,
      elements: [
        ...data.elements.toSorted((a, b) => a.zIndex - b.zIndex),
        copy,
      ].map((e, zIndex) => ({ ...e, zIndex })),
    });
    setSelected(copy.id);
  };
  const moveLayer = (direction: number) => {
    if (!element) return;
    const sorted = [...data.elements].sort((a, b) => a.zIndex - b.zIndex),
      i = sorted.findIndex((e) => e.id === element.id),
      target = i + direction;
    if (target < 0 || target >= sorted.length) return;
    [sorted[i], sorted[target]] = [sorted[target], sorted[i]];
    update({ ...data, elements: sorted.map((e, n) => ({ ...e, zIndex: n })) });
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input,textarea,select,[contenteditable=true],[role=dialog],[role=listbox]",
        )
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (preview || !element || element.locked) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove();
      }
      const delta = event.shiftKey ? 10 : 1;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        changeElement({
          ...element,
          x: Math.max(
            -3840,
            Math.min(
              3840,
              element.x +
                (event.key === "ArrowLeft"
                  ? -delta
                  : event.key === "ArrowRight"
                    ? delta
                    : 0),
            ),
          ),
          y: Math.max(
            -2160,
            Math.min(
              2160,
              element.y +
                (event.key === "ArrowUp"
                  ? -delta
                  : event.key === "ArrowDown"
                    ? delta
                    : 0),
            ),
          ),
        });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function add(type: ElementType) {
    if (data.elements.length >= 60) return;
    const next = newElement(type, t(ELEMENT_LABELS[type]));
    next.zIndex = data.elements.length;
    next.x += (data.elements.length % 6) * 24;
    next.y += (data.elements.length % 6) * 24;
    update({
      ...data,
      elements: [
        ...data.elements.toSorted((a, b) => a.zIndex - b.zIndex),
        next,
      ].map((e, zIndex) => ({ ...e, zIndex })),
    });
    setSelected(next.id);
  }
  function start(
    ev: ReactPointerEvent,
    e: BuilderElement,
    handle: readonly [number, number] | null,
  ) {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    setSelected(e.id);
    if (e.locked) return;
    ev.preventDefault();
    canvas.current?.setPointerCapture(ev.pointerId);
    doc.remember();
    gesture.current = {
      id: e.id,
      startX: ev.clientX,
      startY: ev.clientY,
      element: e,
      handle,
    };
  }
  function motion(ev: ReactPointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const e = g.element,
      dx = (ev.clientX - g.startX) / zoom,
      dy = (ev.clientY - g.startY) / zoom;
    let next = { ...e };
    const lines: { x?: number; y?: number } = {};
    if (!g.handle) {
      next.x = e.x + dx;
      next.y = e.y + dy;
      if (snap && !ev.altKey && e.rotation === 0) {
        const { x: xs, y: ys } = snapTargets(data.elements, e.id);
        const nearest = (start: number, size: number, points: number[]) => {
          let best = 6 / zoom,
            delta = 0,
            line: number | undefined;
          for (const p of points)
            for (const offset of [0, size / 2, size]) {
              const d = p - start - offset;
              if (Math.abs(d) < best) {
                best = Math.abs(d);
                delta = d;
                line = p;
              }
            }
          return { value: start + delta, line };
        };
        const x = nearest(next.x, e.width, xs),
          y = nearest(next.y, e.height, ys);
        next.x = x.value;
        next.y = y.value;
        lines.x = x.line;
        lines.y = y.line;
      }
    } else {
      const [hx, hy] = g.handle,
        a = (e.rotation * Math.PI) / 180,
        c = Math.cos(a),
        s = Math.sin(a),
        lx = dx * c + dy * s,
        ly = -dx * s + dy * c,
        ratio = e.width / e.height;
      let w = Math.max(16, Math.min(3840, e.width + hx * lx)),
        h = Math.max(16, Math.min(2160, e.height + hy * ly));
      if (e.ratioLocked) {
        if (hx === 0) w = h * ratio;
        else if (hy === 0) h = w / ratio;
        else if (Math.abs(w / e.width - 1) > Math.abs(h / e.height - 1))
          h = w / ratio;
        else w = h * ratio;
        const factor = Math.min(1, 3840 / w, 2160 / h);
        w *= factor;
        h *= factor;
        const minimum = Math.max(1, 16 / w, 16 / h);
        w *= minimum;
        h *= minimum;
      }
      if (snap && !ev.altKey) {
        const result = snapResize(
          e,
          w,
          h,
          g.handle,
          snapTargets(data.elements, e.id),
          6 / zoom,
        );
        w = result.width;
        h = result.height;
        Object.assign(lines, result.guides);
      }
      const localX = (hx * (w - e.width)) / 2,
        localY = (hy * (h - e.height)) / 2;
      next.width = w;
      next.height = h;
      next.x = e.x + (e.width - w) / 2 + localX * c - localY * s;
      next.y = e.y + (e.height - h) / 2 + localX * s + localY * c;
    }
    next.x = Math.max(-3840, Math.min(3840, next.x));
    next.y = Math.max(-2160, Math.min(2160, next.y));
    if (
      isDynamic(next) &&
      isDynamic(e) &&
      g.handle &&
      e.properties.scale !== undefined
    )
      next = {
        ...next,
        properties: {
          ...next.properties,
          scale: (e.properties.scale * next.width) / e.width,
        },
      };
    changeElement(next, false);
    setGuides(lines);
  }
  function end(ev: ReactPointerEvent, cancel = false) {
    if (cancel && gesture.current)
      changeElement(gesture.current.element, false);
    gesture.current = null;
    setGuides({});
    if (canvas.current?.hasPointerCapture(ev.pointerId))
      canvas.current.releasePointerCapture(ev.pointerId);
  }
  async function png() {
    if (!art.current) return;
    setExporting(true);
    try {
      await exportBuilderPNG(art.current, data.name);
    } catch {
      doc.setError("Export PNG impossible.");
    } finally {
      setExporting(false);
    }
  }
  function addProfileData() {
    const missing = (["team", "badges", "nuzlocke"] as const).filter(
      (type) => !data.elements.some((e) => e.type === type),
    );
    if (data.elements.length + missing.length > 60) return;
    const parts = missing.map((type) => {
      const e = newElement(type, t(ELEMENT_LABELS[type]));
      const positions = {
        team: [96, 750, 1460, 220],
        badges: [96, 994, 620, 70],
        nuzlocke: [1660, 994, 130, 70],
      };
      const [x, y, width, height] = positions[type];
      return { ...e, x, y, width, height };
    });
    update({
      ...data,
      elements: [
        ...data.elements.toSorted((a, b) => a.zIndex - b.zIndex),
        ...parts,
      ].map((e, zIndex) => ({ ...e, zIndex })),
    });
    if (parts[0]) setSelected(parts[0].id);
  }
  const displayScene = useMemo(
    () => (demo ? withDemoTeam(scene ?? demoScene()) : scene),
    [demo, scene],
  );
  async function save() {
    // Save the measured scale without creating an extra undo step.
    update(data, false);
    return doc.save();
  }
  return (
    <main className={"builder-editor" + (preview ? " is-preview" : "")}>
      <header className="builder-toolbar">
        <Link
          href="/builder"
          className="icon-button"
          aria-label={t("Mes créations")}
        >
          <ArrowLeft size={19} />
        </Link>
        <div className="builder-title">
          <strong>{data.name || t("Mon overlay")}</strong>
          <small>
            {doc.dirty ? t("Modifications non enregistrées") : t("Enregistré")}
          </small>
        </div>
        <div className="builder-toolbar-actions">
          <button
            className="icon-button"
            disabled={!doc.canUndo}
            onClick={doc.undo}
            title={t("Annuler")}
            aria-label={t("Annuler")}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            disabled={!doc.canRedo}
            onClick={doc.redo}
            title={t("Rétablir")}
            aria-label={t("Rétablir")}
          >
            <Redo2 size={17} />
          </button>
          <button
            className="button secondary compact"
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            <Eye size={16} />
            {t(preview ? "Éditer" : "Aperçu")}
          </button>
          <button
            className="button secondary compact"
            disabled={doc.saving}
            onClick={() => void save()}
          >
            <Save size={16} />
            {t(doc.saving ? "Enregistrement…" : "Enregistrer")}
          </button>
          <button
            className="button primary compact"
            disabled={doc.saving}
            onClick={async () => {
              if (await save()) router.push("/builder/" + initial.id + "/obs");
            }}
          >
            <Monitor size={16} />
            {t("Utiliser dans OBS")}
          </button>
        </div>
      </header>
      <div className="builder-sourcebar">
        <label>
          {t("Profil Studio")}
          <Select
            value={data.sceneId ?? "none"}
            aria-label={t("Profil Studio")}
            onValueChange={(sceneId) => {
              setDemo(false);
              update({ ...data, sceneId: sceneId === "none" ? null : sceneId });
            }}
          >
            <SelectOption value="none">
              {t("Choisir un profil Studio")}
            </SelectOption>
            {context.scenes.map((source) => (
              <SelectOption key={source.id} value={source.id}>
                {source.name}
              </SelectOption>
            ))}
          </Select>
        </label>
        {data.sceneId && (
          <>
            <Link
              href={"/studio/" + data.sceneId}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Ouvrir dans Studio")}
            </Link>
            {["team", "badges", "nuzlocke"].some(
              (type) => !data.elements.some((e) => e.type === type),
            ) && (
              <button
                className="button secondary compact"
                onClick={addProfileData}
              >
                {t("Ajouter les données du profil")}
              </button>
            )}
            <span className="builder-note">
              {t(
                demo
                  ? "Démo · aperçu uniquement"
                  : liveError
                    ? "Connexion en cours…"
                    : "Mise à jour en direct",
              )}
            </span>
            {scene &&
              !scene.nuzlocke &&
              data.elements.some((e) => e.type === "nuzlocke") && (
                <span className="builder-note">
                  {t("Active Nuzlocke dans Studio pour afficher le compteur.")}
                </span>
              )}
          </>
        )}
        <TeamPreviewToggle checked={demo} onChange={setDemo} />
      </div>
      {(doc.error || liveError) && (
        <div className="builder-alert" role="alert">
          {doc.error
            ? t(doc.error)
            : t(
                "Données en direct indisponibles. Nouvelle tentative automatique.",
              )}
          {doc.error && (
            <button onClick={() => window.location.reload()}>
              {t("Recharger")}
            </button>
          )}
        </div>
      )}
      {doc.draft && (
        <div className="builder-alert">
          {t("Un brouillon local est disponible.")}
          <button onClick={doc.recover}>{t("Restaurer")}</button>
          <button onClick={doc.discard}>{t("Ignorer")}</button>
        </div>
      )}
      <div className="builder-workspace">
        {!preview && (
          <aside className="builder-library">
            <h2>{t("Éléments")}</h2>
            <div className="builder-add">
              {ELEMENT_TYPES.map((type) => {
                const Icon = icons[type];
                return (
                  <button
                    key={type}
                    disabled={data.elements.length >= 60}
                    onClick={() => add(type)}
                  >
                    <Icon size={20} />
                    <span>{t(ELEMENT_LABELS[type])}</span>
                  </button>
                );
              })}
            </div>
            <div className="builder-layer-heading">
              <h2>
                <Layers size={16} />
                {t("Calques")}
              </h2>
              <span>{data.elements.length}/60</span>
            </div>
            <div className="builder-layers">
              {[...data.elements]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((e) => {
                  const Icon = icons[e.type];
                  return (
                    <div
                      className={e.id === selected ? "selected" : ""}
                      key={e.id}
                    >
                      <button
                        className="builder-layer-name"
                        onClick={() => setSelected(e.id)}
                      >
                        <Icon size={14} />
                        <span>{e.name}</span>
                      </button>
                      <button
                        title={t(e.visible ? "Masquer" : "Afficher")}
                        aria-label={t(e.visible ? "Masquer" : "Afficher")}
                        onClick={() =>
                          changeElement({ ...e, visible: !e.visible })
                        }
                      >
                        {e.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        title={t(e.locked ? "Déverrouiller" : "Verrouiller")}
                        aria-label={t(
                          e.locked ? "Déverrouiller" : "Verrouiller",
                        )}
                        onClick={() =>
                          changeElement({ ...e, locked: !e.locked })
                        }
                      >
                        {e.locked ? (
                          <LockKeyhole size={13} />
                        ) : (
                          <Unlock size={13} />
                        )}
                      </button>
                    </div>
                  );
                })}
            </div>
            <div className="builder-layer-actions">
              {[
                [ArrowDown, "Descendre", () => moveLayer(-1)],
                [ArrowUp, "Monter", () => moveLayer(1)],
                [Copy, "Dupliquer", duplicate],
                [Trash2, "Supprimer", remove],
              ].map(([Icon, label, action]) => {
                const I = Icon as typeof Copy;
                return (
                  <button
                    key={String(label)}
                    className="icon-button"
                    title={t(String(label))}
                    aria-label={t(String(label))}
                    disabled={
                      !element || (label === "Supprimer" && element.locked)
                    }
                    onClick={action as () => void}
                  >
                    <I size={17} />
                  </button>
                );
              })}
            </div>
          </aside>
        )}
        <div
          className="builder-viewport"
          ref={viewport}
          onPointerDown={(ev) => {
            if (ev.target === ev.currentTarget) setSelected(null);
          }}
        >
          <div
            className="builder-zoom-area"
            style={{ width: 1920 * zoom, height: 1080 * zoom }}
          >
            <div
              className="builder-zoom"
              ref={canvas}
              style={{ transform: "scale(" + zoom + ")" }}
              onPointerMove={motion}
              onPointerUp={(ev) => end(ev)}
              onPointerCancel={(ev) => end(ev, true)}
            >
              <BuilderCanvas
                data={data}
                scene={displayScene}
                themes={context.themes}
                elementRef={art}
                placeholders={!preview || demo}
                geometry={geometry}
              />
              {!preview && (
                <div
                  className="builder-interactions"
                  onPointerDown={() => setSelected(null)}
                >
                  {data.elements
                    .filter((e) => e.visible)
                    .map((e) => (
                      <div
                        key={e.id}
                        role="button"
                        tabIndex={0}
                        aria-label={e.name}
                        aria-pressed={selected === e.id}
                        className={
                          "builder-hit" +
                          (selected === e.id ? " selected" : "") +
                          (e.locked ? " locked" : "")
                        }
                        style={{ ...elementStyle(e), opacity: 1 }}
                        onFocus={() => setSelected(e.id)}
                        onPointerDown={(ev) => start(ev, e, null)}
                      >
                        {selected === e.id &&
                          !e.locked &&
                          handles.map(([x, y]) => (
                            <button
                              key={x + "," + y}
                              tabIndex={-1}
                              aria-label={t("Redimensionner")}
                              className="builder-handle"
                              style={{
                                left: (x + 1) * 50 + "%",
                                top: (y + 1) * 50 + "%",
                                width: 8 / zoom,
                                height: 8 / zoom,
                                cursor:
                                  (x === 0
                                    ? "ns"
                                    : y === 0
                                      ? "ew"
                                      : x === y
                                        ? "nwse"
                                        : "nesw") + "-resize",
                              }}
                              onPointerDown={(ev) => start(ev, e, [x, y])}
                            />
                          ))}
                      </div>
                    ))}
                  {guides.x !== undefined && (
                    <span
                      className="builder-guide vertical"
                      style={{ left: guides.x }}
                    />
                  )}
                  {guides.y !== undefined && (
                    <span
                      className="builder-guide horizontal"
                      style={{ top: guides.y }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {!preview && (
          <aside className="builder-properties">
            <button
              className={"builder-scene-tab" + (!element ? " active" : "")}
              onClick={() => setSelected(null)}
            >
              <Settings2 size={15} />
              {t("Réglages de la scène")}
            </button>
            <Inspector
              data={data}
              selected={element}
              update={update}
              updateElement={changeElement}
              context={context}
              scene={displayScene}
              assets={assets}
              onAsset={(a) => {
                doc.trackAsset(a.id);
                setAssets((old) => [a, ...old]);
              }}
              onError={doc.setError}
            />
          </aside>
        )}
      </div>
      <footer className="builder-statusbar">
        <span>1920 × 1080</span>
        <button
          className={snap ? "active" : ""}
          aria-pressed={snap}
          onClick={() => setSnap(!snap)}
        >
          <Magnet size={15} />
          {t("Aimantation")}
        </button>
        <div className="builder-zoom-control">
          <button
            aria-label={t("Réduire")}
            onClick={() => {
              setFit(false);
              setZoom(Math.max(0.1, zoom - 0.1));
            }}
          >
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(zoom * 100)} %</span>
          <button
            aria-label={t("Agrandir")}
            onClick={() => {
              setFit(false);
              setZoom(Math.min(2, zoom + 0.1));
            }}
          >
            <ZoomIn size={16} />
          </button>
          <button onClick={() => setFit(true)}>{t("Ajuster")}</button>
        </div>
        <button disabled={exporting} onClick={() => void png()}>
          <Download size={15} />
          {t(exporting ? "Export…" : "PNG")}
        </button>
      </footer>
    </main>
  );
}
