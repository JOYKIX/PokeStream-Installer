"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { SceneData } from "@/lib/model";
import { measureOverlayBounds } from "@/lib/overlay-bounds";
import { OverlayRenderer } from "./overlay-renderer";

export type OverlayDimensions = { part: string; width: number; height: number };

// The preview and OBS share a natural layout. Recommendations never fix the viewport size.
export function OverlayStage({
  data,
  part = "all",
  viewport = false,
  maxHeight = 360,
  onDimensions,
}: {
  data: SceneData;
  part?: string;
  viewport?: boolean;
  maxHeight?: number;
  onDimensions?: (dimensions: OverlayDimensions) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const reported = useRef<OverlayDimensions | null>(null);
  const [layout, setLayout] = useState({
    scale: 1, left: 0, x: 0, y: 0, height: 200, ready: false,
  });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    const renderer = renderRef.current;
    if (!frame || !content || !renderer) return;
    const team = renderer.querySelector<HTMLElement>(".overlay-team");
    const teamFrame = renderer.querySelector<HTMLElement>(".overlay-team-frame");
    let stopped = false;
    let scheduled = 0;
    const measure = () => {
      if (stopped) return;
      if (team && teamFrame) {
        // Reserve the team's scaled footprint using its untransformed layout size.
        // CSS zoom yields different geometry across browser/OBS Chromium versions.
        const css = getComputedStyle(team);
        const teamScale = Number(css.getPropertyValue("--team-scale")) || 1;
        const width = (parseFloat(css.width) || team.offsetWidth) * teamScale + "px";
        const height = (parseFloat(css.height) || team.offsetHeight) * teamScale + "px";
        if (teamFrame.style.width !== width) teamFrame.style.width = width;
        if (teamFrame.style.height !== height) teamFrame.style.height = height;
      }
      const bounds = measureOverlayBounds(renderer, Number(content.dataset.scale) || 1);
      const { width, height } = bounds;
      const previous = reported.current;
      if (!previous || previous.part !== part || previous.width !== width || previous.height !== height) {
        reported.current = { part, width, height };
        onDimensions?.(reported.current);
      }
      const availableHeight = viewport ? frame.clientHeight : maxHeight;
      if (!frame.clientWidth || !availableHeight) return;
      const scale = width && height
        ? Math.min(1, frame.clientWidth / width, availableHeight / height)
        : 1;
      const next = {
        scale,
        left: viewport ? 0 : Math.max(0, (frame.clientWidth - width * scale) / 2),
        x: -bounds.x, y: -bounds.y,
        height: Math.ceil(height * scale),
        ready: true,
      };
      setLayout((old) =>
        old.scale === next.scale && old.left === next.left && old.x === next.x &&
        old.y === next.y && old.height === next.height && old.ready ? old : next,
      );
    };
    const schedule = () => {
      if (stopped || scheduled) return;
      scheduled = requestAnimationFrame(() => { scheduled = 0; measure(); });
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(frame);
    resize.observe(renderer);
    if (team) resize.observe(team);
    // A failed item image can remove an absolutely positioned sprite without resizing its parent.
    const mutation = new MutationObserver(schedule);
    mutation.observe(renderer, { childList: true, characterData: true, subtree: true });
    renderer.addEventListener("load", schedule, true);
    renderer.addEventListener("error", schedule, true);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(schedule);
    measure();
    return () => {
      stopped = true;
      cancelAnimationFrame(scheduled);
      resize.disconnect();
      mutation.disconnect();
      renderer.removeEventListener("load", schedule, true);
      renderer.removeEventListener("error", schedule, true);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [data, part, viewport, maxHeight, onDimensions]);

  return (
    <div ref={frameRef} className="overlay-stage"
      style={{ height: viewport ? "100dvh" : layout.height }}>
      <div ref={contentRef} className="overlay-stage-content" data-scale={layout.scale}
        style={{
          left: layout.left,
          transform: "scale(" + layout.scale + ")",
          opacity: layout.ready ? 1 : 0,
        }}>
        <div ref={renderRef} className="overlay-stage-layout"
          style={{ transform: "translate(" + layout.x + "px, " + layout.y + "px)" }}>
          <OverlayRenderer data={data} part={part} />
        </div>
      </div>
    </div>
  );
}
