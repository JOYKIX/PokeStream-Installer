import { getTranslations } from "@/i18n/server";
import { z } from "zod";
import { authenticated, readJson, sameOrigin } from "@/lib/api";
import { localRepository as adminClient } from "@/local/repository";
import { STARTER_IDS } from "@/themes/catalog";
import { getStarter } from "@/themes/server";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const schema = z.object({ theme: z.enum(STARTER_IDS) });

export async function POST(request: Request) {
  const tr = await getTranslations();
  if (!sameOrigin(request)) return Response.json({ error: tr("Origine refusée.") }, { status: 403, headers });
  const { user } = await authenticated();
  if (!user) return Response.json({ error: tr("Connecte-toi pour choisir ton starter.") }, { status: 401, headers });
  const parsed = schema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: tr("Choisis Eau, Feu ou Plante.") }, { status: 400, headers });
  try {
    // The unique account key and INSERT-only permissions make this choice permanent,
    // including concurrent requests from multiple tabs. No owner id comes from the body.
    const { error } = await adminClient().from("theme_starters").upsert(
      { owner_id: user.id, theme: parsed.data.theme },
      { onConflict: "owner_id", ignoreDuplicates: true },
    );
    if (error) throw error;
    const starter = await getStarter(user.id);
    if (!starter) throw new Error("Missing starter");
    return Response.json({ starter }, { headers });
  } catch {
    return Response.json({ error: tr("Enregistrement impossible. Réessaie.") }, { status: 503, headers });
  }
}
