import sources from "@/data/sprite-sources.json";
export const SPRITE_IDS = [
  "artwork",
  "dream-world",
  "home",
  "animated",
  "pixel",
  "red-green",
  "red-blue",
  "yellow",
  "gold",
  "silver",
  "crystal",
  "crystal-animated",
  "ruby-sapphire",
  "emerald",
  "emerald-animated",
  "firered-leafgreen",
  "icons-iii",
  "diamond-pearl",
  "diamond-pearl-animated",
  "platinum",
  "platinum-animated",
  "heartgold-soulsilver",
  "heartgold-soulsilver-animated",
  "icons-iv",
  "black-white",
  "black-white-animated",
  "icons-v",
  "icons-v-animated",
  "x-y",
  "omega-alpha",
  "icons-vi",
  "ultra-sun-moon",
  "lets-go",
  "icons-lets-go",
  "icons-vii",
  "icons-viii",
  "brilliant-shining",
  "scarlet-violet",
  "champions",
] as const;

export type SpriteStyle = (typeof SPRITE_IDS)[number];
export const SPRITE_VARIANTS = [
  "default",
  "back",
  "gray",
  "back-gray",
  "gbc",
  "back-gbc",
  "transparent",
  "back-transparent",
  "transparent-gray",
  "back-transparent-gray",
] as const;
export type SpriteVariant = (typeof SPRITE_VARIANTS)[number];
export const VARIANT_LABELS: Record<SpriteVariant, string> = {
  default: "Face",
  back: "Dos",
  gray: "Face · gris",
  "back-gray": "Dos · gris",
  gbc: "Face · Game Boy Color",
  "back-gbc": "Dos · Game Boy Color",
  transparent: "Face · transparent",
  "back-transparent": "Dos · transparent",
  "transparent-gray": "Face · gris transparent",
  "back-transparent-gray": "Dos · gris transparent",
};
export const SPRITE_SOURCES = sources as (Omit<
  (typeof sources)[number],
  "id"
> & { id: SpriteStyle })[];
export const SPRITE_GROUPS = [...new Set(SPRITE_SOURCES.map((s) => s.group))];
export function spriteSource(id: SpriteStyle) {
  return SPRITE_SOURCES.find((s) => s.id === id)!;
}
