import { getTranslations } from "@/i18n/server";
import { authenticated, readJson, sameOrigin } from "@/lib/api";
import { sceneSchema } from "@/lib/model";
import { canUseTheme } from "@/themes/server";
export async function POST(request: Request) {
  const tr = await getTranslations();
  if (!sameOrigin(request))
    return Response.json({ error: tr("Origine refusée.") }, { status: 403 });
  const { supabase, user } = await authenticated();
  if (!user)
    return Response.json(
      { error: tr("Connecte-toi pour continuer.") },
      { status: 401 },
    );
  const parsed = sceneSchema.safeParse(
    await readJson(request).catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: tr("Profil invalide.") }, { status: 400 });
  if (
    !(await canUseTheme(user.id, parsed.data.style.theme, parsed.data.style.customThemeId))
  )
    return Response.json(
      { error: tr("Thème introuvable.") },
      { status: 403 },
    );
  // Keep only the theme reference; the definition is resolved from the owner record.
  delete parsed.data.style.customTheme;
  if (parsed.data.style.theme !== "custom") { delete parsed.data.style.customThemeId; delete parsed.data.style.customAccent; }
  const { data, error } = await supabase
    .from("scenes")
    .insert({ owner_id: user.id, data: parsed.data })
    .select()
    .single();
  if (error)
    return Response.json(
      {
        error: error.message.includes("scene_limit")
          ? tr("Limite de 20 profils atteinte.")
          : tr("Création impossible. Réessaie."),
      },
      { status: 400 },
    );
  return Response.json(data, { status: 201 });
}
