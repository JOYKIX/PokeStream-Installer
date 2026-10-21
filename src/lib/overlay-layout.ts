import type { SceneData } from "./model";

type Style = SceneData["style"];

export function teamLayout(style: Style) {
  return style.teamLayout ?? (style.orientation === "vertical" ? "1x6" : "6x1");
}

export function badgeColumnOptions(count: number) {
  return Array.from({ length: count }, (_, i) => count - i)
    .filter((columns) => count % columns === 0);
}

export function badgeLayout(style: Style, count: number): number | "auto" {
  const value = style.badgeColumns ?? (style.orientation === "vertical" ? "auto" : count);
  // A layout from another game must never leave empty columns or an invalid menu value.
  return value === "auto" || !badgeColumnOptions(count).includes(value) ? "auto" : value;
}

export function badgeColumns(style: Style, count: number) {
  if (count < 1) return 1;
  const layout = badgeLayout(style, count);
  if (layout !== "auto") return layout;
  const square = Math.ceil(Math.sqrt(count));
  const balanced = badgeColumnOptions(count).filter((columns) => columns >= square).at(-1) ?? count;
  return balanced <= square * 1.5 ? balanced : square;
}

// Older scenes scaled both the container and its sprite with the same setting.
export function itemSpriteScale(style: Style) {
  return style.itemSpriteScale ?? style.itemScale ?? 1;
}
