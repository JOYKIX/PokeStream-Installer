import "server-only";
import { localRepository as adminClient } from "@/local/repository";
import { canUseTheme, getStarter } from "@/themes/server";
import { getAccess } from "@/lib/access";
import { listCustomThemes } from "@/themes/custom/server";
import { requiresPro } from "@/themes/catalog";
import { availableTheme } from "@/lib/premium";
import { effectiveScene } from "@/lib/connect";
import { sceneSchema } from "@/lib/model";
import { resolveCustomTheme } from "@/themes/custom/resolve";
import { builderSchema, type BuilderData, type BuilderRecord } from "./schema";
export const builderColumns =
  "id,slot,view_token,enabled,data,version,updated_at,created_at";
export const builderHeaders = { "Cache-Control": "private, no-store" };
export class BuilderError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function listBuilders(owner: string): Promise<BuilderRecord[]> {
  const { data, error } = await adminClient()
    .from("builder_overlays")
    .select(builderColumns)
    .eq("owner_id", owner)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function builderContext(owner: string) {
  const db = adminClient();
  const [access, starter, themes, scenes] = await Promise.all([
    getAccess(owner),
    getStarter(owner),
    listCustomThemes(owner),
    db
      .from("scenes")
      .select("id,data")
      .eq("owner_id", owner)
      .order("created_at"),
  ]);
  if (scenes.error) throw scenes.error;
  return {
    active: access.active,
    grade: access.grade,
    starter,
    themes,
    scenes: (scenes.data ?? []).map((s) => ({
      id: s.id,
      name: s.data.name as string,
    })),
  };
}
export async function validateBuilder(owner: string, data: BuilderData) {
  const refs = [
    data.theme,
    ...data.elements.flatMap((e) => (e.themeOverride ? [e.themeOverride] : [])),
  ];
  const unique = [
    ...new Map(
      refs.map((ref) => [ref.id + ":" + (ref.customId ?? ""), ref]),
    ).values(),
  ];
  const permissions = await Promise.all(
    unique.map((ref) => canUseTheme(owner, ref.id, ref.customId)),
  );
  if (permissions.some((allowed) => !allowed))
    throw new BuilderError("Thème introuvable.", 403);
  const db = adminClient();
  if (data.sceneId) {
    const { data: scene, error } = await db
      .from("scenes")
      .select("id")
      .eq("owner_id", owner)
      .eq("id", data.sceneId)
      .maybeSingle();
    if (error) throw error;
    if (!scene) throw new BuilderError("Profil Studio introuvable.", 400);
  }
  const ids = [
    ...new Set(
      data.elements.flatMap((e) =>
        e.type === "image" && e.properties.assetId
          ? [e.properties.assetId]
          : [],
      ),
    ),
  ];
  if (ids.length) {
    const { data: assets, error } = await db
      .from("builder_assets")
      .select("id")
      .eq("ready", true)
      .eq("owner_id", owner)
      .in("id", ids);
    if (error) throw error;
    if (assets?.length !== ids.length)
      throw new BuilderError("Image introuvable.", 400);
  }
}
export async function displayBuilder(owner: string, raw: unknown) {
  const data = builderSchema.parse(raw),
    db = adminClient();
  const [access, starter, themes] = await Promise.all([
    getAccess(owner),
    getStarter(owner),
    listCustomThemes(owner),
  ]);
  // Recheck live access on every refresh. No stale entitlement is embedded in saved documents.
  const resolve = (ref: BuilderData["theme"]) =>
    (requiresPro(ref.id, starter) && !access.active) ||
    (ref.id === "custom" && !themes.some((t) => t.id === ref.customId))
      ? { id: "carbon" as const }
      : ref;
  data.theme = resolve(data.theme);
  data.elements = data.elements.map((e) => ({
    ...e,
    themeOverride: e.themeOverride ? resolve(e.themeOverride) : null,
  }));
  let scene = null;
  if (data.sceneId) {
    const [source, device] = await Promise.all([
      db
        .from("scenes")
        .select("data")
        .eq("owner_id", owner)
        .eq("id", data.sceneId)
        .maybeSingle(),
      db
        .from("connect_devices")
        .select("snapshot")
        .eq("owner_id", owner)
        .eq("scene_id", data.sceneId)
        .maybeSingle(),
    ]);
    if (source.error || device.error) throw source.error || device.error;
    if (source.data) {
      const parsed = sceneSchema.safeParse(source.data.data);
      if (parsed.success)
        scene = resolveCustomTheme(
          availableTheme(
            effectiveScene(parsed.data, device.data?.snapshot),
            access.active,
            starter,
          ),
          access.active ? themes : [],
        );
    }
  }
  const used = new Set(
    [
      data.theme,
      ...data.elements.flatMap((e) =>
        e.themeOverride ? [e.themeOverride] : [],
      ),
    ].flatMap((r) => (r.id === "custom" && r.customId ? [r.customId] : [])),
  );
  return {
    data,
    scene,
    themes: themes
      .filter((t) => used.has(t.id))
      .map((t) => ({ id: t.id, config: t.config })),
    expiresAt: Date.now() + 15000,
  };
}
