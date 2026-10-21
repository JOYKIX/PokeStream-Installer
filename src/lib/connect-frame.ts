import { z } from "zod";
import { GAMES } from "./games";
import catalog from "@/data/pokedex.json";
import { pokemonSchema, TYPES } from "./model";
import gameData from "@/data/connect-game-data.json";
import { findItem } from "./items";
import { snapshotSchema } from "./connect";
const forms = gameData.forms as Record<
  string,
  { pokemonId: number; apiName: string; types: string[]; formSprite?: string }
>;
const items = gameData.items as Record<string, Record<string, string>>;
export const frameSchema = z
  .object({
    sceneId: z.uuid().optional(),
    game: snapshotSchema.shape.game,
    deaths: snapshotSchema.shape.deaths,
    badges: snapshotSchema.shape.badges,
    team: z
      .array(
        z
          .object({
            species: z.number().int().min(1).max(1025),
            nickname: z.string().max(12),
            level: z.number().int().min(1).max(100),
            shiny: z.boolean(),
            egg: z.boolean(),
            hp: z.number().int().min(0).max(2047),
            maxHp: z.number().int().min(1).max(2047),
            heldItem: z.number().int().min(0).max(4095).optional(),
            gender: z.number().int().min(0).max(2).optional(),
            form: z.number().int().min(0).max(255).optional(),
            generation: z.number().int().min(1).max(9).optional(),
            // Optional game metadata must not reject an otherwise valid team from Connect.
            types: z
              .array(z.enum(TYPES))
              .min(1)
              .max(2)
              .transform((types) => [...new Set(types)])
              .optional()
              .catch(undefined),
          })
          .strict()
          .refine((p) => p.hp <= p.maxHp),
      )
      .min(1)
      .max(6),
  })
  .strict()
  .superRefine((frame, ctx) => {
    if (
      (frame.deaths !== undefined || frame.badges !== undefined) &&
      !frame.sceneId
    )
      ctx.addIssue({
        code: "custom",
        message: "Aventure requise pour le suivi automatique.",
      });
    if (frame.badges?.some((i) => i >= GAMES[frame.game].badges.length))
      ctx.addIssue({ code: "custom", message: "Badge invalide pour ce jeu." });
  });
export const deviceFrameSchema = z.union([
  frameSchema,
  z
    .object({ sceneId: z.uuid(), deaths: z.number().int().min(0).max(9999) })
    .strict(),
]);
export function convertFrame(frame: z.infer<typeof frameSchema>) {
  const team = frame.team.map((p) => {
    const entry = catalog.find((e) => e.id === p.species);
    if (!entry) throw new Error("Espèce non prise en charge.");
    const form =
      p.generation !== undefined && p.form !== undefined
        ? forms[p.generation + ":" + p.species + ":" + p.form]
        : undefined;
    const item =
      p.generation !== undefined && p.heldItem !== undefined
        ? findItem(items[p.generation]?.[p.heldItem] ?? "")
        : undefined;
    return pokemonSchema.parse({
      speciesId: p.egg ? 1 : p.species,
      pokemonId: p.egg ? 1 : (form?.pokemonId ?? p.species),
      name: p.egg ? "Œuf" : entry.name,
      apiName: p.egg ? "egg" : (form?.apiName ?? entry.slug),
      nickname: p.egg ? "" : p.nickname,
      level: p.egg ? 1 : p.level,
      shiny: !p.egg && p.shiny,
      fainted: !p.egg && p.hp === 0,
      item: p.egg ? "" : (item?.slug ?? ""),
      gender: p.egg
        ? "unknown"
        : p.gender === 0
          ? "male"
          : p.gender === 1
            ? "female"
            : "unknown",
      form: p.egg ? undefined : p.form,
      formSprite: p.egg ? undefined : form?.formSprite,
      hp: p.egg ? undefined : p.hp,
      maxHp: p.egg ? undefined : p.maxHp,
      types: p.egg ? ["normal"] : (p.types ?? form?.types ?? entry.types),
      isEgg: p.egg,
    });
  });
  return {
    game: frame.game,
    ...(frame.sceneId !== undefined && { sceneId: frame.sceneId }),
    ...(frame.deaths !== undefined && { deaths: frame.deaths }),
    ...(frame.badges !== undefined && { badges: frame.badges }),
    team: [...team, ...Array(6 - team.length).fill(null)],
  };
}
