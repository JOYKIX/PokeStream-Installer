import { getTranslations } from "@/i18n/server";
import { z } from "zod";
import { authenticated, readJson, sameOrigin } from "@/lib/api";
import { sceneSchema } from "@/lib/model";
import { canUseTheme } from "@/themes/server";
const updateSchema = z.object({
  data: sceneSchema.optional(),
  enabled: z.boolean().optional(),
  rotateToken: z.boolean().optional(),
  version: z.number().int().min(1),
});
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const tr = await getTranslations();
  if (!sameOrigin(request))
    return Response.json({ error: tr("Origine refusée.") }, { status: 403 });
  const { supabase, user } = await authenticated();
  if (!user)
    return Response.json(
      { error: tr("Session expirée. Reconnecte-toi.") },
      { status: 401 },
    );
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Introuvable." }, { status: 404 });
  const parsed = updateSchema.safeParse(
    await readJson(request).catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: tr("Paramètres invalides.") }, { status: 400 });
  const { data: sceneData, enabled, rotateToken, version } = parsed.data;
  if (sceneData && !(await canUseTheme(user.id, sceneData.style.theme, sceneData.style.customThemeId)))
    return Response.json(
      { error: tr("Thème introuvable.") },
      { status: 403 },
    );
  if (sceneData) {
    delete sceneData.style.customTheme;
    if (sceneData.style.theme !== "custom") { delete sceneData.style.customThemeId; delete sceneData.style.customAccent; }
  }
  const patch = {
    ...(sceneData ? { data: sceneData } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(rotateToken ? { view_token: crypto.randomUUID() } : {}),
  };
  const { data, error } = await supabase
    .from("scenes")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("version", version)
    .select()
    .maybeSingle();
  if (error)
    return Response.json(
      { error: tr("Enregistrement impossible. Réessaie.") },
      { status: 500 },
    );
  if (!data)
    return Response.json(
      {
        error:
          tr("Ce profil a changé dans un autre onglet. Recharge-le avant de continuer."),
      },
      { status: 409 },
    );
  return Response.json(data);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const tr = await getTranslations();
  if (!sameOrigin(request))
    return Response.json({ error: tr("Origine refusée.") }, { status: 403 });
  const { supabase, user } = await authenticated();
  if (!user)
    return Response.json(
      { error: tr("Connecte-toi pour continuer.") },
      { status: 401 },
    );
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Introuvable." }, { status: 404 });
  const { error } = await supabase
    .from("scenes")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error)
    return Response.json({ error: tr("Suppression impossible.") }, { status: 500 });
  return new Response(null, { status: 204 });
}
