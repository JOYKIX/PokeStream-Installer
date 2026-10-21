import type { BuilderElement } from "./schema";
export type SnapTargets = { x: number[]; y: number[] };
export function snapTargets(
  elements: BuilderElement[],
  exclude: string,
): SnapTargets {
  const others = elements.filter(
    (e) => e.id !== exclude && e.visible && e.rotation === 0,
  );
  return {
    x: [
      ...new Set([
        0,
        960,
        1920,
        ...others.flatMap((e) => [e.x, e.x + e.width / 2, e.x + e.width]),
      ]),
    ],
    y: [
      ...new Set([
        0,
        540,
        1080,
        ...others.flatMap((e) => [e.y, e.y + e.height / 2, e.y + e.height]),
      ]),
    ],
  };
}
// Keep the opposite handle anchored. Snap the active handle in canvas coordinates,
// including rotated elements, while solving resize deltas in the element's axes.
export function snapResize(
  e: BuilderElement,
  width: number,
  height: number,
  handle: readonly [number, number],
  targets: SnapTargets,
  tolerance: number,
) {
  const [hx, hy] = handle,
    angle = (e.rotation * Math.PI) / 180;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const anchor = {
    x: e.x + e.width / 2 - ((hx * e.width) / 2) * c + ((hy * e.height) / 2) * s,
    y:
      e.y + e.height / 2 - ((hx * e.width) / 2) * s - ((hy * e.height) / 2) * c,
  };
  const point = (w: number, h: number) => ({
    x: anchor.x + hx * w * c - hy * h * s,
    y: anchor.y + hx * w * s + hy * h * c,
  });
  const current = point(width, height);
  const near = {
    x: targets.x.filter((x) => Math.abs(x - current.x) <= tolerance),
    y: targets.y.filter((y) => Math.abs(y - current.y) <= tolerance),
  };
  let best = {
    width,
    height,
    guides: {} as { x?: number; y?: number },
    matches: 0,
    distance: Infinity,
  };
  const consider = (w: number, h: number) => {
    if (
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w < 16 ||
      w > 3840 ||
      h < 16 ||
      h > 2160
    )
      return;
    const p = point(w, h),
      distance = Math.hypot(p.x - current.x, p.y - current.y);
    // Avoid a large jump when a rotated edge is almost parallel to a guide.
    if (distance > tolerance * Math.SQRT2) return;
    const x = near.x.find((x) => Math.abs(p.x - x) < 0.01);
    const y = near.y.find((y) => Math.abs(p.y - y) < 0.01);
    const matches = Number(x !== undefined) + Number(y !== undefined);
    if (
      matches > best.matches ||
      (matches === best.matches && distance < best.distance)
    )
      best = { width: w, height: h, guides: { x, y }, matches, distance };
  };
  if (e.ratioLocked || hx === 0 || hy === 0) {
    const vector = e.ratioLocked
      ? {
          x: hx * width * c - hy * height * s,
          y: hx * width * s + hy * height * c,
        }
      : { x: hx * c - hy * s, y: hx * s + hy * c };
    for (const axis of ["x", "y"] as const) {
      if (Math.abs(vector[axis]) < 0.000001) continue;
      for (const guide of near[axis]) {
        const delta = (guide - current[axis]) / vector[axis];
        if (e.ratioLocked) consider(width * (1 + delta), height * (1 + delta));
        else consider(width + (hx ? delta : 0), height + (hy ? delta : 0));
      }
    }
  } else {
    const adjust = (dx: number, dy: number) =>
      consider(
        width + hx * (dx * c + dy * s),
        height + hy * (-dx * s + dy * c),
      );
    for (const x of near.x) adjust(x - current.x, 0);
    for (const y of near.y) adjust(0, y - current.y);
    for (const x of near.x)
      for (const y of near.y) adjust(x - current.x, y - current.y);
  }
  return { width: best.width, height: best.height, guides: best.guides };
}
