import { getTranslations } from "@/i18n/server";
import { z } from "zod";
import { readJson, sameOrigin } from "@/lib/api";
import { getUser } from "@/local/session";
import { localRepository as adminClient } from "@/local/repository";
import { isFavoriteId } from "@/themes/favorite-id";
import { findCustomTheme } from "@/themes/custom/server";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const favoriteSchema = z.object({ theme: z.string().refine(isFavoriteId), favorite: z.boolean() });

export async function GET() {
  const tr = await getTranslations();
  const user = await getUser();
  if (!user) return Response.json({ error: tr("Connecte-toi pour retrouver tes favoris.") }, { status: 401, headers });
  try {
    const { data, error } = await adminClient().from("theme_favorites")
      .select("theme").eq("owner_id", user.id);
    if (error) throw error;
    return Response.json({ favorites: (data ?? []).map((row) => row.theme).filter(isFavoriteId) }, { headers });
  } catch {
    return Response.json({ error: tr("Chargement des favoris impossible.") }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const tr = await getTranslations();
  if (!sameOrigin(request)) return Response.json({ error: tr("Origine refusée.") }, { status: 403, headers });
  const user = await getUser();
  if (!user) return Response.json({ error: tr("Connecte-toi pour enregistrer tes favoris.") }, { status: 401, headers });
  const parsed = favoriteSchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: tr("Favori invalide.") }, { status: 400, headers });
  const { theme, favorite } = parsed.data;
  try {
    if (favorite && theme.startsWith("custom-") && !(await findCustomTheme(user.id, theme.slice(7))))
      return Response.json({ error: tr("Thème introuvable.") }, { status: 404, headers });
    const client = adminClient();
    // Mutate one preference, never replace the whole account's library. The
    // authenticated account is the only source of the owner id, including deletes.
    const { error } = favorite
      ? await client.from("theme_favorites").upsert(
          { owner_id: user.id, theme }, { onConflict: "owner_id,theme", ignoreDuplicates: true },
        )
      : await client.from("theme_favorites").delete().eq("owner_id", user.id).eq("theme", theme);
    if (error) throw error;
    return Response.json({ theme, favorite }, { headers });
  } catch {
    return Response.json({ error: tr("Enregistrement du favori impossible. Réessaie.") }, { status: 503, headers });
  }
}
