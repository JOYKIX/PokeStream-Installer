import { z } from "zod";
import { getUser } from "@/local/session";
import { sameOrigin } from "@/lib/api";
import { localRepository as adminClient } from "@/local/repository";
import { getTranslations } from "@/i18n/server";
import { cleanupBuilderAssets } from "@/builder/assets-server";
import { builderSchema } from "@/builder/schema";
import {
  BuilderError,
  builderColumns,
  builderHeaders,
  validateBuilder,
} from "@/builder/server";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, ctx: Context) {
  const t = await getTranslations(),
    fail = (key: string, status: number) =>
      Response.json({ error: t(key) }, { status, headers: builderHeaders });
  if (!sameOrigin(request)) return fail("Origine refusée.", 403);
  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.", 401);
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return fail("Création introuvable.", 404);
  const text = await request.text();
  if (text.length > 240000) return fail("Création invalide.", 413);
  const p = z
    .object({
      data: builderSchema,
      version: z.number().int().positive(),
      enabled: z.boolean().optional(),
      rotateToken: z.boolean().optional(),
      discardAssets: z.array(z.uuid()).max(200).optional(),
    })
    .strict()
    .safeParse(
      (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
    );
  if (!p.success) return fail("Création invalide.", 400);
  try {
    await validateBuilder(user.id, p.data.data);
    const { data, error } = await adminClient()
      .from("builder_overlays")
      .update({
        data: p.data.data,
        version: p.data.version + 1,
        updated_at: new Date().toISOString(),
        ...(p.data.enabled !== undefined ? { enabled: p.data.enabled } : {}),
        ...(p.data.rotateToken ? { view_token: crypto.randomUUID() } : {}),
      })
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("version", p.data.version)
      .select(builderColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new BuilderError("La création a changé. Recharge la page.", 409);
    const assets = await cleanupBuilderAssets(user.id, p.data.discardAssets);
    return Response.json(
      { overlay: data, assets },
      { headers: builderHeaders },
    );
  } catch (e) {
    return fail(
      e instanceof BuilderError ? e.message : "Enregistrement impossible.",
      e instanceof BuilderError ? e.status : 503,
    );
  }
}
export async function DELETE(request: Request, ctx: Context) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  const parsed = z
    .object({ version: z.number().int().positive() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return new Response(null, { status: 400 });
  const { data, error } = await adminClient()
    .from("builder_overlays")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("version", parsed.data.version)
    .select("id")
    .maybeSingle();
  if (data && !error) await cleanupBuilderAssets(user.id);
  return Response.json(
    { deleted: !!data },
    { status: error ? 503 : data ? 200 : 409, headers: builderHeaders },
  );
}
