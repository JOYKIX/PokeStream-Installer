import { z } from "zod";
import { SPRITE_IDS, SPRITE_VARIANTS } from "@/lib/sprite-options";
export const CUSTOM_THEME_LIMIT = 5;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const radius = z.number().int().min(0).max(40);
export const TYPE_COLORS = { normal:"#a8a878", fire:"#f78342", water:"#6399f4", electric:"#f4d147", grass:"#6bbc64", ice:"#81d3d5", fighting:"#d96550", poison:"#b46bce", ground:"#c8a06e", flying:"#9e9bda", psychic:"#ee75a0", bug:"#a9b849", rock:"#b3a373", ghost:"#9b81c0", dragon:"#8c74f1", dark:"#a59a94", steel:"#9baabc", fairy:"#e3a2c5" } as const;
export type ThemeType = keyof typeof TYPE_COLORS;
const typePalette = z.object(Object.fromEntries(Object.keys(TYPE_COLORS).map((key) => [key,color])) as Record<ThemeType,typeof color>).strict();
export const surfaceSchema = z.object({
  color, colorEnd: color, gradient: z.boolean(), opacity: z.number().int().min(0).max(100),
  border: color, borderWidth: z.number().int().min(0).max(4), radius,
  borderStyle: z.enum(["solid","dashed","double"]).default("solid"),
  gradientMode: z.enum(["linear","radial"]).default("linear"), angle: z.number().int().min(0).max(360).default(145),
  pattern: z.enum(["none","dots","grid","lines"]).default("none"), patternColor: color.default("#ffffff"),
  patternOpacity: z.number().int().min(0).max(50).default(8), patternScale: z.number().int().min(4).max(40).default(12),
}).strict();
const textSchema = z.object({
  color, size: z.number().int().min(50).max(160), bold: z.boolean(),
  tracking: z.number().int().min(-2).max(6).default(0), uppercase: z.boolean().default(false),
  shadow: z.enum(["none","soft","outline"]).default("none"),
}).strict();
export const customThemeConfigSchema = z.object({
  schemaVersion: z.literal(1), accent: color,
  font: z.enum(["inter", "space", "pixel"]), align: z.enum(["left", "center", "right"]),
  sprite: z.enum(SPRITE_IDS), spriteVariant: z.enum(SPRITE_VARIANTS),
  sizes: z.object({ sprite: z.number().int().min(50).max(160), gender: z.number().int().min(50).max(160), item: z.number().int().min(50).max(160), itemSprite: z.number().int().min(50).max(200), badges: z.number().int().min(50).max(160), counter: z.number().int().min(50).max(160) }).strict(),
  card: surfaceSchema, cardAccent: z.enum(["none", "top", "bottom", "left", "right"]),
  accentWidth: z.number().int().min(1).max(8).default(3),
  cardWidth: z.number().int().min(160).max(360).default(204),
  cardPadding: z.number().int().min(0).max(32).default(12),
  contentGap: z.number().int().min(0).max(24).default(0),
  spriteEffect: z.enum(["none","shadow","glow"]).default("none"), spriteRotation: z.number().int().min(-20).max(20).default(0),
  shadow: z.enum(["none", "soft", "crisp"]), spacing: z.number().int().min(4).max(28),
  spritePanel: surfaceSchema, spritePanelVisible: z.boolean(),
  name: textSchema, level: textSchema,
  types: z.object({ natural: z.boolean(), color, background: color, radius, size: z.number().int().min(50).max(160),
    mode: z.enum(["tonal","solid","outline"]).default("tonal"), intensity: z.number().int().min(0).max(100).default(18),
    palette: typePalette.default(() => ({ ...TYPE_COLORS })),
  }).strict(),
  gender: z.object({ male: color, female: color, radius }).strict(),
  item: surfaceSchema,
  health: z.object({ high: color, medium: color, low: color, track: color, text: color, border: color, radius, height: z.number().int().min(4).max(18), striped: z.boolean() }).strict(),
  badges: surfaceSchema, counter: surfaceSchema, counterText: color, counterIcon: color,
  badgeGap: z.number().int().min(0).max(30).default(10), badgePadding: z.number().int().min(0).max(32).default(12),
  counterLayout: z.enum(["horizontal","vertical"]).default("horizontal"),
  counterIconVisible: z.boolean().default(true),
}).strict();
export type CustomThemeConfig = z.infer<typeof customThemeConfigSchema>;
export type ThemeSurface = z.infer<typeof surfaceSchema>;
export const themeInputSchema = z.object({
  name: z.string().trim().min(1).max(40).refine((s) => !/[\u0000-\u001f\u007f]/.test(s)),
  config: customThemeConfigSchema,
}).strict();
export const customThemeSchema = themeInputSchema.extend({
  id: z.uuid(), slot: z.number().int().min(1).max(CUSTOM_THEME_LIMIT),
  version: z.number().int().positive(), created_at: z.string(), updated_at: z.string(),
});
export type CustomTheme = z.infer<typeof customThemeSchema>;
export type ThemeInput = z.infer<typeof themeInputSchema>;
const surface = (color: string, border: string, radius = 12): ThemeSurface => surfaceSchema.parse({
  color, colorEnd: color, gradient: false, opacity: 100, border, borderWidth: 1, radius,
});
export function defaultCustomTheme(): CustomThemeConfig {
  return customThemeConfigSchema.parse({
    schemaVersion: 1, accent: "#ef3340", font: "inter", align: "center",
    sprite: "artwork", spriteVariant: "default",
    sizes: { sprite: 100, gender: 100, item: 100, itemSprite: 100, badges: 100, counter: 100 },
    card: { ...surface("#171b22", "#343b46"), colorEnd: "#242b36", gradient: true },
    cardAccent: "bottom", shadow: "soft", spacing: 12,
    spritePanel: surface("#10151c", "#293341", 8), spritePanelVisible: true,
    name: { color: "#f1f3f5", size: 100, bold: true },
    level: { color: "#a9b3bf", size: 100, bold: false },
    types: { natural: true, color: "#e6ebf1", background: "#253040", radius: 4, size: 100 },
    gender: { male: "#256397", female: "#9b365e", radius: 4 },
    item: surface("#252c37", "#ef3340", 24),
    health: { high: "#69b991", medium: "#e7b956", low: "#e97777", track: "#0b0f16", text: "#a9b3bf", border: "#343b46", radius: 5, height: 8, striped: false },
    badges: surface("#171b22", "#343b46"), counter: surface("#171b22", "#343b46"),
    counterText: "#f1f3f5", counterIcon: "#ef3340",
  });
}
export function customThemePreset(preset: "dark" | "light" | "pixel"): CustomThemeConfig {
  const c = defaultCustomTheme();
  if (preset === "light") return { ...c, accent: "#bd493b",
    card: surface("#f2eee6", "#cfc5b5"), spritePanel: surface("#e4dfd5", "#cfc5b5", 8),
    name: { ...c.name, color: "#302e2b" }, level: { ...c.level, color: "#686257" },
    badges: surface("#f2eee6", "#cfc5b5"), counter: surface("#f2eee6", "#cfc5b5"),
    counterText: "#302e2b", counterIcon: "#bd493b",
    item: surface("#f2eee6", "#bd493b", 24), health: { ...c.health, track: "#d2ccbf", text: "#686257", border: "#cfc5b5" },
  };
  if (preset === "pixel") return { ...c, font: "pixel", shadow: "crisp", accent: "#b7cf82",
    card: { ...surface("#25302b", "#7c9168", 0), borderWidth: 3 },
    spritePanel: { ...surface("#acbf8b", "#4e634b", 0), borderWidth: 2 },
    name: { ...c.name, color: "#e9f0d1" }, level: { ...c.level, color: "#bbc99d" },
    types: { ...c.types, radius: 0 }, gender: { ...c.gender, radius: 0 },
    item: { ...surface("#25302b", "#7c9168", 0), borderWidth: 2 },
    health: { ...c.health, radius: 0, striped: true },
    badges: { ...surface("#25302b", "#7c9168", 0), borderWidth: 3 },
    counter: { ...surface("#25302b", "#7c9168", 0), borderWidth: 3 }, counterIcon: "#b7cf82",
  };
  return c;
}

