import { z } from "zod";
import { TEAM_LAYOUTS } from "@/lib/model";
import { SPRITE_IDS, SPRITE_VARIANTS } from "@/lib/sprite-options";
import { THEME_IDS } from "@/themes/catalog";
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const themeRefSchema = z
  .object({
    id: z.enum(THEME_IDS),
    customId: z.uuid().optional(),
    accent: color.optional(),
  })
  .strict();
export type ThemeRef = z.infer<typeof themeRefSchema>;
export const ELEMENT_TYPES = [
  "game-screen",
  "team",
  "badges",
  "nuzlocke",
  "camera",
  "chat",
  "image",
  "text",
] as const;
export const ELEMENT_LABELS: Record<ElementType, string> = {
  "game-screen": "Écran de jeu",
  team: "Équipe",
  badges: "Badges",
  nuzlocke: "Nuzlocke",
  camera: "Caméra",
  chat: "Chat",
  image: "Image",
  text: "Texte",
};
export type ElementType = (typeof ELEMENT_TYPES)[number];
export const PLATFORM_SIZES = {
  gb: [160, 144],
  gbc: [160, 144],
  gba: [240, 160],
  ds: [256, 192],
  "3ds-top": [400, 240],
  "3ds-bottom": [320, 240],
  switch: [1280, 720],
  custom: [640, 480],
} as const;
export const PLATFORM_LABELS = {
  gb: "GB",
  gbc: "GBC",
  gba: "GBA",
  ds: "DS",
  "3ds-top": "3DS · Écran supérieur",
  "3ds-bottom": "3DS · Écran inférieur",
  switch: "Switch",
  custom: "Personnalisé",
};
const slot = z
  .object({
    platform: z.enum([
      "gb",
      "gbc",
      "gba",
      "ds",
      "3ds-top",
      "3ds-bottom",
      "switch",
      "custom",
    ]),
    screen: z.enum(["top", "bottom"]),
    transparent: z.boolean(),
    showFrame: z.boolean(),
    frameWidth: z.number().int().min(2).max(64),
  })
  .strict();
const base = {
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  x: z.number().min(-3840).max(3840),
  y: z.number().min(-2160).max(2160),
  width: z.number().min(16).max(3840),
  height: z.number().min(16).max(2160),
  rotation: z.number().min(-180).max(180),
  opacity: z.number().min(0).max(1),
  zIndex: z.number().int().min(0).max(100),
  locked: z.boolean(),
  visible: z.boolean(),
  ratioLocked: z.boolean(),
  themeOverride: themeRefSchema.nullable(),
  themeSource: z.enum(["main", "studio"]).optional(),
  accentOverride: color.nullable().optional(),
};
const dynamic = z
  .object({
    // A uniform scale keeps the selection, content and resize handles together.
    scale: z.number().min(0.001).max(1000).optional(),
  })
  .strict();
const teamProperties = dynamic.extend({
  layout: z.enum(TEAM_LAYOUTS).nullable().optional(),
  sprite: z.enum(SPRITE_IDS).nullable().optional(),
  spriteVariant: z.enum(SPRITE_VARIANTS).nullable().optional(),
});
const badgeProperties = dynamic.extend({
  columns: z
    .union([z.literal("auto"), z.number().int().min(1).max(100)])
    .nullable()
    .optional(),
});
export const elementSchema = z.discriminatedUnion("type", [
  z
    .object({ ...base, type: z.literal("game-screen"), properties: slot })
    .strict(),
  z.object({ ...base, type: z.literal("camera"), properties: slot }).strict(),
  z.object({ ...base, type: z.literal("chat"), properties: slot }).strict(),
  z
    .object({ ...base, type: z.literal("team"), properties: teamProperties })
    .strict(),
  z
    .object({ ...base, type: z.literal("badges"), properties: badgeProperties })
    .strict(),
  z
    .object({ ...base, type: z.literal("nuzlocke"), properties: dynamic })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("image"),
      properties: z
        .object({
          assetId: z.uuid().nullable(),
          fit: z.enum(["contain", "cover"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("text"),
      properties: z
        .object({
          text: z.string().max(500),
          font: z.enum(["inter", "space", "pixel"]),
          size: z.number().int().min(8).max(240),
          bold: z.boolean(),
          color: color.nullable(),
          align: z.enum(["left", "center", "right"]),
        })
        .strict(),
    })
    .strict(),
]);
export type BuilderElement = z.infer<typeof elementSchema>;
export const builderSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(60),
    width: z.literal(1920),
    height: z.literal(1080),
    sceneId: z.uuid().nullable(),
    useStudioStyle: z.boolean().default(true),
    theme: themeRefSchema,
    background: z
      .object({ mode: z.enum(["theme", "color", "transparent"]), color })
      .strict(),
    elements: z
      .array(elementSchema)
      .max(60)
      .refine((es) => new Set(es.map((e) => e.id)).size === es.length),
  })
  .strict();
export type BuilderData = z.infer<typeof builderSchema>;
export type BuilderRecord = {
  id: string;
  slot: number;
  view_token: string;
  enabled: boolean;
  data: BuilderData;
  version: number;
  updated_at: string;
  created_at: string;
};
export type BuilderAsset = {
  id: string;
  name: string;
  width: number;
  height: number;
};
export function newBuilder(name = "Mon overlay"): BuilderData {
  return {
    schemaVersion: 1,
    name,
    width: 1920,
    height: 1080,
    sceneId: null,
    useStudioStyle: false,
    theme: { id: "carbon" },
    background: { mode: "theme", color: "#11141b" },
    elements: [],
  };
}
export function external(
  e: BuilderElement,
): e is Extract<BuilderElement, { type: "game-screen" | "camera" | "chat" }> {
  return e.type === "game-screen" || e.type === "camera" || e.type === "chat";
}
export function newElement(type: ElementType, name: string): BuilderElement {
  const b = {
    id: crypto.randomUUID(),
    name,
    x: 96,
    y: 96,
    width: 640,
    height: 480,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
    ratioLocked: true,
    themeOverride: null,
  };
  if (type === "image")
    return { ...b, type, properties: { assetId: null, fit: "contain" } };
  if (type === "text")
    return {
      ...b,
      type,
      width: 480,
      height: 80,
      ratioLocked: false,
      properties: {
        text: name,
        font: "space",
        size: 40,
        bold: true,
        color: null,
        align: "left",
      },
    };
  if (type === "team")
    return { ...b, type, width: 1400, height: 300, properties: {} };
  if (type === "badges")
    return { ...b, type, width: 560, height: 100, properties: {} };
  if (type === "nuzlocke")
    return { ...b, type, width: 120, height: 70, properties: {} };
  return {
    ...b,
    type,
    width: type === "chat" ? 340 : 640,
    height: type === "chat" ? 600 : 480,
    ratioLocked: type !== "chat",
    properties: {
      platform: type === "game-screen" ? "ds" : "custom",
      screen: "top",
      transparent: true,
      showFrame: true,
      frameWidth: 14,
    },
  };
}

export type DynamicElement = Extract<
  BuilderElement,
  { type: "team" | "badges" | "nuzlocke" }
>;
export function isDynamic(e: BuilderElement): e is DynamicElement {
  return e.type === "team" || e.type === "badges" || e.type === "nuzlocke";
}
