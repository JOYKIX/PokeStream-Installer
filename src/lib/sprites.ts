import { eggSpriteCandidates } from "./egg-sprites";
import availability from "@/data/sprite-availability.json";
import formAvailability from "@/data/connect-form-sprites.json";
import {
  spriteSource,
  SPRITE_VARIANTS,
  type SpriteStyle,
  type SpriteVariant,
} from "./sprite-options";

const BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const manifest = availability as Record<string, Record<string, number[][]>>;
const formManifest = formAvailability as Record<string, Record<string, string[]>>;
type Subject = {
  pokemonId: number;
  isEgg?: boolean;
  formSprite?: string;
  speciesId?: number;
  shiny: boolean;
  gender?: "male" | "female" | "unknown";
};
export type SpriteCandidate = {
  url: string;
  pixelated: boolean;
  source: SpriteStyle;
};
function variantParts(variant: SpriteVariant) {
  return variant === "default" ? [] : variant.split("-");
}
export function availableVariants(style: SpriteStyle): SpriteVariant[] {
  const dirs = Object.keys(manifest[style]);
  return SPRITE_VARIANTS.filter((v) => {
    const wanted = variantParts(v).sort().join("/");
    return dirs.some(
      (dir) =>
        dir
          .split("/")
          .filter((p) => p && p !== "shiny" && p !== "female")
          .sort()
          .join("/") === wanted,
    );
  });
}
function candidates(p: Subject, style: SpriteStyle, variant: SpriteVariant) {
  const source = spriteSource(style);
  const wanted = [
    ...variantParts(variant),
    ...(p.shiny ? ["shiny"] : []),
    ...(p.gender === "female" ? ["female"] : []),
  ];
  const formDirs = p.formSprite ? formManifest[p.formSprite]?.[style] : undefined;
  if (p.formSprite && !formDirs?.length) return [];
  const available = formDirs?.length
    ? Object.fromEntries(formDirs.map((dir) => [dir, [[p.pokemonId, p.pokemonId]]]))
    : manifest[style];
  const filename = formDirs?.length ? p.formSprite : p.pokemonId;
  return Object.entries(available)
    .filter(
      ([dir, ranges]) =>
        dir.split("/").every((v) => !v || wanted.includes(v)) &&
        ranges.some(
          ([start, end]) => p.pokemonId >= start && p.pokemonId <= end,
        ),
    )
    .sort(([a], [b]) => {
      const score = (dir: string) =>
        dir
          .split("/")
          .reduce(
            (sum, v) =>
              sum + (v === "shiny" ? 8 : v === "female" ? 4 : v ? 16 : 0),
            0,
          );
      return score(b) - score(a);
    })
    .map(([dir]) => ({
      url: [BASE, source.path, dir, filename + "." + source.extension]
        .filter(Boolean)
        .join("/"),
      pixelated: source.pixelated,
      source: style,
    }));
}
export function spriteCandidates(
  p: Subject,
  style: SpriteStyle = "artwork",
  variant: SpriteVariant = "default",
): SpriteCandidate[] {
  if (p.isEgg) return eggSpriteCandidates(style, variant);
  const list = [
    ...candidates(p, style, variant),
    ...candidates(p, "pixel", variant),
    ...candidates(p, "artwork", "default"),
  ];
  if (p.formSprite || p.speciesId && p.speciesId !== p.pokemonId) {
    const base = { ...p, formSprite: undefined, pokemonId: p.speciesId ?? p.pokemonId };
    list.push(
      ...candidates(base, style, variant),
      ...candidates(base, "pixel", variant),
    );
  }
  return list.filter(
    (item, i) => list.findIndex((other) => other.url === item.url) === i,
  );
}
