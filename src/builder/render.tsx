"use client";
import {
  memo,
  useSyncExternalStore,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { OverlayRenderer } from "@/components/overlay-renderer";
import { measureOverlayBounds } from "@/lib/overlay-bounds";
import type { SceneData } from "@/lib/model";
import { appearance, elementAppearance, type DisplayTheme } from "./appearance";
export type { DisplayTheme } from "./appearance";
import {
  fitDynamicElement,
  useBuilderGeometry,
  type BoundsReporter,
} from "./geometry";
import { useI18n } from "@/i18n/client";
import { external, type BuilderData, type BuilderElement } from "./schema";
const DynamicBlock = memo(function DynamicBlock({
  data,
  part,
  element,
  onBounds,
}: {
  data: SceneData;
  part: string;
  element: BuilderElement;
  onBounds: BoundsReporter;
}) {
  const [ready, setReady] = useState(false);
  const portal = useSyncExternalStore<HTMLElement | null>(() => () => {}, () => document.body, () => null);
  const ref = useRef<HTMLDivElement>(null),
    [box, setBox] = useState({ x: 0, y: 0, width: 1, height: 1 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0,
      done = false;
    const measure = () => {
      frame = 0;
      if (done) return;
      const team = node.querySelector<HTMLElement>(".overlay-team"),
        holder = node.querySelector<HTMLElement>(".overlay-team-frame");
      if (team && holder) {
        const css = getComputedStyle(team),
          scale = Number(css.getPropertyValue("--team-scale")) || 1;
        holder.style.width =
          (parseFloat(css.width) || team.offsetWidth) * scale + "px";
        holder.style.height =
          (parseFloat(css.height) || team.offsetHeight) * scale + "px";
      }
      const bounds = measureOverlayBounds(node, 1);
      onBounds(element.id, bounds);
      setReady(true);
      setBox((old) =>
        JSON.stringify(old) === JSON.stringify(bounds) ? old : bounds,
      );
    };
    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(measure);
      },
      resize = new ResizeObserver(schedule);
    const mutation = new MutationObserver(schedule);
    mutation.observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    resize.observe(node);
    node
      .querySelectorAll(".overlay-team,.overlay-badges,.overlay-deaths")
      .forEach((n) => resize.observe(n));
    node.addEventListener("load", schedule, true);
    node.addEventListener("error", schedule, true);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => {
      done = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      node.removeEventListener("load", schedule, true);
      node.removeEventListener("error", schedule, true);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [data, part, portal, element.id, onBounds]);
  const { width, height } = fitDynamicElement(element, ready ? box : undefined);
  const scale = Math.min(
    width / Math.max(box.width, 1),
    height / Math.max(box.height, 1),
  );
  return (
    <>
      <div
        className="builder-dynamic overlay-stage"
        style={{ width, height, opacity: ready ? 1 : 0 }}
      >
        <div
          className="builder-dynamic-scale"
          style={{ transform: "scale(" + scale + ")" }}
        >
          <div
            className="overlay-stage-layout"
            style={{
              transform: "translate(" + -box.x + "px," + -box.y + "px)",
            }}
          >
            <OverlayRenderer data={data} part={part} />
          </div>
        </div>
      </div>
      {portal &&
        createPortal(
          <div className="builder-measure overlay-stage">
            <div ref={ref} className="overlay-stage-layout">
              <OverlayRenderer data={data} part={part} />
            </div>
          </div>,
          portal,
        )}
    </>
  );
});
export function ElementContent({
  element: e,
  data,
  scene,
  themes,
  token,
  onBounds,
}: {
  element: BuilderElement;
  data: BuilderData;
  scene: SceneData | null;
  themes: DisplayTheme[];
  token?: string;
  onBounds: BoundsReporter;
}) {
  const look = elementAppearance(e, data, scene, themes);
  const styledScene = useMemo(
    () =>
      scene
        ? {
            ...scene,
            style: {
              ...scene.style,
              theme: look.themeId,
              accent: look.accent,
              customTheme: look.config,
              customThemeId: look.customId,
              // Clear a Studio custom accent when following a different Builder theme.
              customAccent: look.config ? look.accent : undefined,
            },
          }
        : null,
    [scene, look.themeId, look.accent, look.config, look.customId],
  );
  const layout = e.type === "team" ? e.properties.layout : null;
  const columns = e.type === "badges" ? e.properties.columns : null;
  const sprite = e.type === "team" ? e.properties.sprite : null;
  const spriteVariant = e.type === "team" ? e.properties.spriteVariant : null;
  const typeBadgeStyle = e.type === "team" ? e.properties.typeBadgeStyle : null;
  const themedScene = useMemo(
    () =>
      styledScene && (layout || columns != null || sprite || spriteVariant || typeBadgeStyle)
        ? {
            ...styledScene,
            style: {
              ...styledScene.style,
              ...(layout ? { teamLayout: layout } : {}),
              ...(columns != null ? { badgeColumns: columns } : {}),
              ...(sprite ? { sprite } : {}),
              ...(spriteVariant ? { spriteVariant } : {}),
              ...(typeBadgeStyle ? { typeBadgeStyle } : {}),
            },
          }
        : styledScene,
    [styledScene, layout, columns, sprite, spriteVariant, typeBadgeStyle],
  );
  if (external(e))
    return (
      <div
        className={
          "builder-slot " +
          look.className +
          (e.properties.showFrame ? " framed" : "") +
          (e.properties.transparent ? " transparent" : "")
        }
        style={
          {
            ...look.style,
            "--frame-width": e.properties.frameWidth + "px",
          } as CSSProperties
        }
      />
    );
  if (e.type === "image")
    return e.properties.assetId ? (
      <img
        className="builder-image"
        alt=""
        draggable={false}
        src={
          "/api/builder/assets/" +
          e.properties.assetId +
          (token ? "?token=" + encodeURIComponent(token) : "")
        }
        style={{ objectFit: e.properties.fit }}
      />
    ) : null;
  if (e.type === "text")
    return (
      <div
        className={"builder-text " + look.className}
        style={{
          ...look.style,
          fontFamily: {
            inter: '"Inter Variable",sans-serif',
            space: '"Space Grotesk Variable",sans-serif',
            pixel: '"Pixelify Sans Variable",monospace',
          }[e.properties.font],
          fontSize: e.properties.size,
          fontWeight: e.properties.bold ? 750 : 400,
          color: e.properties.color ?? "var(--ink)",
          textAlign: e.properties.align,
        }}
      >
        {e.properties.text}
      </div>
    );
  if (!themedScene) return null;
  return (
    <DynamicBlock
      data={themedScene}
      part={e.type === "nuzlocke" ? "deaths" : e.type}
      element={e}
      onBounds={onBounds}
    />
  );
}
export function elementStyle(e: BuilderElement): CSSProperties {
  return {
    position: "absolute",
    left: e.x,
    top: e.y,
    width: e.width,
    height: e.height,
    transform: "rotate(" + e.rotation + "deg)",
    opacity: e.opacity,
    zIndex: e.zIndex,
  };
}
export function BuilderCanvas({
  data,
  scene,
  themes,
  token,
  elementRef,
  placeholders = false,
  geometry,
}: {
  data: BuilderData;
  scene: SceneData | null;
  themes: DisplayTheme[];
  token?: string;
  elementRef?: Ref<HTMLDivElement>;
  placeholders?: boolean;
  geometry?: ReturnType<typeof useBuilderGeometry>;
}) {
  const ownGeometry = useBuilderGeometry();
  const { bounds, report } = geometry ?? ownGeometry;
  const { t } = useI18n(),
    look = appearance(data.theme, themes),
    visible = data.elements
      .filter((e) => e.visible)
      .map((e) => fitDynamicElement(e, bounds[e.id]))
      .sort((a, b) => a.zIndex - b.zIndex);
  // Punch through the complete composition, not merely a transparent div over an opaque background.
  const holes = visible
    .filter(external)
    .filter((e) => e.properties.transparent)
    .map(
      (e) =>
        '<rect x="' +
        e.x +
        '" y="' +
        e.y +
        '" width="' +
        e.width +
        '" height="' +
        e.height +
        '" fill="black" transform="rotate(' +
        e.rotation +
        " " +
        (e.x + e.width / 2) +
        " " +
        (e.y + e.height / 2) +
        ')"/>',
    )
    .join("");
  const mask =
    'url("data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="white"/>' +
        holes +
        "</svg>",
    ) +
    '")';
  return (
    <div
      className="builder-canvas"
      style={{ width: data.width, height: data.height }}
    >
      <div
        ref={elementRef}
        className="builder-art"
        style={{
          width: data.width,
          height: data.height,
          maskImage: mask,
          maskMode: "luminance",
          maskSize: "100% 100%",
        }}
      >
        <div
          className={"builder-background " + look.className}
          style={{
            ...look.style,
            background:
              data.background.mode === "transparent"
                ? "transparent"
                : data.background.mode === "color"
                  ? data.background.color
                  : "var(--surface)",
          }}
        />
        {visible.map((e) => (
          <div key={e.id} style={elementStyle(e)}>
            <ElementContent
              element={e}
              data={data}
              scene={scene}
              themes={themes}
              token={token}
              onBounds={report}
            />
          </div>
        ))}
      </div>
      {placeholders &&
        visible.map((e) =>
          external(e) ? (
            <div
              key={e.id}
              className="builder-placeholder"
              style={elementStyle(e)}
            >
              <span>{e.name}</span>
              <small>
                {Math.round(e.width)} × {Math.round(e.height)}
              </small>
            </div>
          ) : (!scene && ["team", "badges", "nuzlocke"].includes(e.type)) ||
            (e.type === "image" && !e.properties.assetId) ? (
            <div
              key={e.id}
              className="builder-placeholder"
              style={elementStyle(e)}
            >
              <span>{e.name}</span>
              <small>
                {t(
                  e.type === "image"
                    ? "Importer une image"
                    : "Choisir un profil Studio",
                )}
              </small>
            </div>
          ) : null,
        )}
    </div>
  );
}
