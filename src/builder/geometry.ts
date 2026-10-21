"use client";
import { useCallback, useState } from "react";
import { isDynamic, type BuilderElement } from "./schema";
export type ContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type BoundsReporter = (id: string, bounds: ContentBounds) => void;
export function useBuilderGeometry() {
  const [bounds, setBounds] = useState<Record<string, ContentBounds>>({});
  const report = useCallback<BoundsReporter>((id, next) => {
    setBounds((old) => {
      const previous = old[id];
      return previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
        ? old
        : { ...old, [id]: next };
    });
  }, []);
  return { bounds, report };
}
// Bounds include all six reserved team slots, or painted content for other blocks. Legacy
// documents derive an initial scale from their old rectangle to keep visual size.
export function fitDynamicElement(
  e: BuilderElement,
  bounds?: ContentBounds,
): BuilderElement {
  if (!isDynamic(e) || !bounds?.width || !bounds.height) return e;
  const requested =
    e.properties.scale ??
    Math.min(e.width / bounds.width, e.height / bounds.height);
  const scale = Math.max(
    0.001,
    Math.min(
      1000,
      3840 / bounds.width,
      2160 / bounds.height,
      Math.max(16 / bounds.width, 16 / bounds.height, requested),
    ),
  );
  return {
    ...e,
    width: bounds.width * scale,
    height: bounds.height * scale,
    ratioLocked: true,
    properties: { ...e.properties, scale },
  };
}
