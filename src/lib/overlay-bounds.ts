type Outset = { left: number; top: number; right: number; bottom: number };

function shadowOutset(value: string, filter = false): Outset {
  const outset = { left: 0, top: 0, right: 0, bottom: 0 };
  for (const shadow of value.split(/,(?![^()]*\))/)) {
    if (shadow.includes("inset")) continue;
    const lengths = [...shadow.matchAll(/(-?(?:\d*\.)?\d+)px/g)].map((match) =>
      Number(match[1]),
    );
    if (lengths.length < 2) continue;
    const [x, y, blur = 0, spread = 0] = lengths;
    // A small allowance for the Gaussian shadow beyond the element's border box.
    const radius = Math.max(0, blur * (filter ? 3 : 1.5) + spread);
    outset.left = Math.max(outset.left, radius - x);
    outset.top = Math.max(outset.top, radius - y);
    outset.right = Math.max(outset.right, radius + x);
    outset.bottom = Math.max(outset.bottom, radius + y);
  }
  return outset;
}

// Team sources measure six invisible reference cards; individual slots and other
// blocks still measure painted content. Generic frame boxes never participate.
const PAINTED_ELEMENTS = [
  ".overlay-mon",
  ".overlay-mon-art",
  ".overlay-mon-info strong",
  ".overlay-level",
  ".type-pill",
  ".overlay-gender",
  ".overlay-health",
  ".overlay-health-track",
  ".overlay-health-values",
  ".pokemon-image",
  ".missing-sprite",
  ".shiny-icon",
  ".overlay-held-item",
  ".item-sprite",
  ".overlay-badges.badge-case",
  ".badge-case-slot",
  ".badge-imprint",
  ".overlay-badges img",
  ".overlay-deaths",
  ".overlay-deaths strong",
  ".overlay-deaths svg",
].join(",");

// Read visible geometry including artwork, item sprites and shadows. Dividing out
// only the preview transform retains the independent scale of each overlay block.
export function measureOverlayBounds(root: HTMLElement, previewScale: number) {
  const origin = root.getBoundingClientRect();
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const element of root.querySelectorAll<HTMLElement | SVGSVGElement>(
    PAINTED_ELEMENTS,
  )) {
    if (element instanceof SVGElement && !(element instanceof SVGSVGElement))
      continue;
    const reserved = !!element.closest("[data-overlay-reserved]");
    // Actual team content must not resize OBS or the Builder selection rectangle.
    if (!reserved && element.closest(".overlay-team-reserved")) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const css = getComputedStyle(element);
    if ((!reserved && css.visibility === "hidden") || css.display === "none")
      continue;
    const zoom = Number(css.getPropertyValue("--overlay-unit-scale")) || 1;
    const box = shadowOutset(css.boxShadow);
    const text = shadowOutset(css.textShadow);
    const filters = [
      ...css.filter.matchAll(/drop-shadow\((?:[^()]|\([^()]*\))*\)/g),
    ].map((match) => shadowOutset(match[0], true));
    // Sequential filters can add their shadows outside an existing box/text shadow.
    const bleed = (edge: keyof Outset) =>
      (Math.max(box[edge], text[edge]) +
        filters.reduce((sum, shadow) => sum + shadow[edge], 0)) *
      zoom;
    left = Math.min(
      left,
      (rect.left - origin.left) / previewScale - bleed("left"),
    );
    top = Math.min(top, (rect.top - origin.top) / previewScale - bleed("top"));
    right = Math.max(
      right,
      (rect.right - origin.left) / previewScale + bleed("right"),
    );
    bottom = Math.max(
      bottom,
      (rect.bottom - origin.top) / previewScale + bleed("bottom"),
    );
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 0, height: 0 };
  // One pixel protects antialiasing; rounding removes subpixel measurement jitter.
  const x = Math.floor(left + 0.01) - 1;
  const y = Math.floor(top + 0.01) - 1;
  return {
    x,
    y,
    width: Math.ceil(right - 0.01) + 1 - x,
    height: Math.ceil(bottom - 0.01) + 1 - y,
  };
}
