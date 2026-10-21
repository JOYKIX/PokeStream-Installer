import { z } from "zod";
import { customThemeConfigSchema } from "@/themes/custom/schema";
import { THEME_IDS } from "@/themes/catalog";
import { SPRITE_IDS, SPRITE_VARIANTS } from "./sprite-options";

export const TEAM_LAYOUTS = ["6x1", "1x6", "3x2", "2x3"] as const;

export const TEAM_ELEMENTS = ["sprite", "name", "level", "types", "health"] as const;
export type TeamElement = (typeof TEAM_ELEMENTS)[number];

// Append newly introduced elements without moving an existing saved arrangement.
export function teamElementOrder(saved?: readonly TeamElement[]): TeamElement[] {
  return [...new Set([...(saved ?? []), ...TEAM_ELEMENTS])];
}

export const TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;
export const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};
export const pokemonSchema = z.object({
  speciesId: z.number().int().min(1).max(2000),
  pokemonId: z.number().int().min(1).max(20000),
  name: z.string().min(1).max(60),
  apiName: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  nickname: z.string().max(24),
  level: z.number().int().min(1).max(100),
  shiny: z.boolean(),
  gender: z.enum(["male", "female", "unknown"]).optional(),
  form: z.number().int().min(0).max(255).optional(),
  formSprite: z.string().regex(/^\d{1,5}-[a-z0-9-]+$/).max(80).optional(),
  hp: z.number().int().min(0).max(2047).optional(),
  maxHp: z.number().int().min(1).max(2047).optional(),
  isEgg: z.boolean().optional(),
  fainted: z.boolean(),
  item: z.string().max(40),
  types: z.array(z.enum(TYPES)).min(1).max(2),
}).superRefine((pokemon, ctx) => {
  if ((pokemon.hp === undefined) !== (pokemon.maxHp === undefined) ||
      (pokemon.hp !== undefined && pokemon.maxHp !== undefined && pokemon.hp > pokemon.maxHp))
    ctx.addIssue({ code: "custom", message: "PV invalides." });
}).transform((pokemon) => pokemon.isEgg ? {
  ...pokemon,
  // Redact the hatch species and nickname at every scene/snapshot boundary.
  speciesId: 1,
  pokemonId: 1,
  name: "Œuf",
  apiName: "egg",
  nickname: "",
  level: 1,
  shiny: false,
  gender: "unknown" as const,
  form: undefined,
  formSprite: undefined,
  hp: undefined,
  maxHp: undefined,
  fainted: false,
  item: "",
  types: ["normal"] as Array<(typeof TYPES)[number]>,
} : pokemon);
export const sceneSchema = z.object({
  name: z.string().trim().min(1).max(48),
  game: z.enum([
    "kanto",
    "johto",
    "hoenn",
    "sinnoh",
    "unova",
    "unova2",
    "kalos",
    "alola",
    "hisui",
    "galar-sword",
    "galar-shield",
    "paldea",
  ]),
  team: z.array(pokemonSchema.nullable()).length(6),
  badges: z.array(z.number().int().min(0).max(17)).max(18),
  nuzlocke: z.boolean(),
  deaths: z.number().int().min(0).max(9999),
  style: z.object({
    theme: z.enum(THEME_IDS),
    customThemeId: z.uuid().optional(),
    customAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    // Display snapshot, always replaced by the server-owned theme.
    customTheme: customThemeConfigSchema.optional(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    // Kept for importing older scenes. New layouts are independent.
    orientation: z.enum(["horizontal", "vertical"]),
    teamLayout: z.enum(TEAM_LAYOUTS).optional(),
    badgeColumns: z.union([z.literal("auto"), z.number().int().min(1).max(100)]).optional(),
    sprite: z.enum(SPRITE_IDS),
    spriteVariant: z.enum(SPRITE_VARIANTS).optional(),
    elementOrder: z.preprocess((value) => Array.isArray(value) ? value.filter((element) => element !== "gender") : value,
      z.array(z.enum(TEAM_ELEMENTS))
      .min(4).max(TEAM_ELEMENTS.length)
      .refine((order) => new Set(order).size === order.length &&
        (["sprite", "name", "level", "types"] as const).every((element) => order.includes(element)),
        "Chaque élément doit apparaître une seule fois."))
      .optional(),
    showSprites: z.boolean().optional(),
    showNames: z.boolean(),
    showLevels: z.boolean(),
    showTypes: z.boolean(),
    showGender: z.boolean().optional(),
    showHealth: z.boolean().optional(),
    showHealthValues: z.boolean().optional(),
    showItems: z.boolean(),
    showBadges: z.boolean(),
    badgeBackground: z.boolean().optional(),
    // Legacy scenes keep their size until each section is adjusted.
    scale: z.number().min(0.5).max(1.5),
    teamScale: z.number().min(0.5).max(2).optional(),
    badgeScale: z.number().min(0.5).max(2).optional(),
    deathScale: z.number().min(0.5).max(2).optional(),
    spriteScale: z.number().min(0.5).max(2).optional(),
    nameScale: z.number().min(0.5).max(2).optional(),
    levelScale: z.number().min(0.5).max(2).optional(),
    typeScale: z.number().min(0.5).max(2).optional(),
    genderScale: z.number().min(0.5).max(2).optional(),
    healthScale: z.number().min(0.5).max(2).optional(),
    itemScale: z.number().min(0.5).max(2).optional(),
    itemSpriteScale: z.number().min(0.5).max(2).optional(),
  }),
});
export type Pokemon = z.infer<typeof pokemonSchema>;
export type SceneData = z.infer<typeof sceneSchema>;
export type Scene = {
  id: string;
  owner_id: string;
  view_token: string;
  enabled: boolean;
  data: SceneData;
  version: number;
  updated_at: string;
  created_at: string;
};
export type CatalogEntry = {
  id: number;
  name: string;
  en: string;
  slug: string;
  types: string[];
};
export function emptyScene(
  name = "Mon profil",
  game: SceneData["game"] = "kanto",
): SceneData {
  return {
    name,
    game,
    team: Array(6).fill(null),
    badges: [],
    nuzlocke: false,
    deaths: 0,
    style: {
      theme: "carbon",
      accent: "#ef3340",
      orientation: "horizontal",
      sprite: "artwork",
      showNames: true,
      showLevels: true,
      showTypes: true,
      showItems: false,
      showBadges: true,
      scale: 1,
    },
  };
}
export const normalizeSearch = (s: string) =>
  s.normalize("NFKC").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").normalize("NFC")
    .toLowerCase().replace(/ß/g, "ss")
    .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .replace(/[^\p{L}\p{N}]/gu, "");
export function searchPokemon(
  catalog: CatalogEntry[],
  query: string,
  type = "all",
  localizedNames: Record<string, string> = {},
) {
  const q = normalizeSearch(query);
  return catalog.filter(
    (p) =>
      (type === "all" || p.types.includes(type)) &&
      (!q ||
        String(p.id) === q.replace(/^0+/, "") ||
        normalizeSearch(p.name).includes(q) ||
        normalizeSearch(p.en).includes(q) ||
        normalizeSearch(localizedNames[String(p.id)] || "").includes(q)),
  );
}
