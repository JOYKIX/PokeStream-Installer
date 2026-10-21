import { z } from "zod";
import { GAMES } from "./games";
import { pokemonSchema, sceneSchema, type SceneData } from "./model";

export function safeReturnTo(value?: string) {
  if (!value || /[\\\x00-\x20]/.test(value)) return "/studio";
  return /^\/(?:connect|studio|profile|theme-studio|theme-creator|builder)(?:[/?]|$)/.test(value) ? value : "/studio";
}
export const pairingSchema = z.object({
  device: z.uuid(),
  challenge: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(1).max(60),
  scene: z.uuid().optional(),
});
export const snapshotSchema = z.object({
  game: sceneSchema.shape.game,
  team: z.array(pokemonSchema.nullable()).length(6),
  deaths: sceneSchema.shape.deaths.optional(),
  badges: z.array(z.number().int().min(0).max(17)).max(18).transform((values) => [...new Set(values)].sort((a, b) => a - b)).optional(),
});
export function effectiveScene(data: SceneData, snapshot: unknown): SceneData {
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) return data;
  const next = parsed.data;
  if (next.badges?.some((i) => i >= GAMES[next.game].badges.length)) return data;
  return { ...data, ...next };
}
