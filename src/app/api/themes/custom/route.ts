import { z } from "zod";
import { getUser } from "@/local/session";
import { localRepository as adminClient } from "@/local/repository";
import { readJson, sameOrigin } from "@/lib/api";
import { getTranslations } from "@/i18n/server";
import { CUSTOM_THEME_LIMIT, themeInputSchema } from "@/themes/custom/schema";
import { listCustomThemes, themeColumns } from "@/themes/custom/server";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const createSchema = themeInputSchema.extend({ id: z.uuid() });
export async function GET() {
 const tr = await getTranslations();
 const user = await getUser();
 if (!user) return Response.json({ error: tr("Session expirée. Reconnecte-toi.") }, { status: 401, headers });
 try {
   return Response.json({ themes: await listCustomThemes(user.id) }, { headers });
 } catch {
   return Response.json({ error: tr("Chargement des thèmes impossible.") }, { status: 503, headers });
 }
}
export async function POST(request: Request) {
 const tr = await getTranslations();
 const fail = (key: string, status: number) => Response.json({ error: tr(key) }, { status, headers });
 if (!sameOrigin(request)) return fail("Origine refusée.", 403);
 const user = await getUser();
 if (!user) return fail("Session expirée. Reconnecte-toi.", 401);
 const parsed = createSchema.safeParse(await readJson(request).catch(() => null));
 if (!parsed.success) return fail("Vérifie le nom et les réglages du thème.", 400);
 try {
   for (let attempt = 0; attempt < CUSTOM_THEME_LIMIT; attempt++) {
     const themes = await listCustomThemes(user.id);
     const existing = themes.find((t) => t.id === parsed.data.id);
     if (existing) {
       const saved = themeInputSchema.parse({ name: existing.name, config: existing.config });
       const incoming = { name: parsed.data.name, config: parsed.data.config };
       if (JSON.stringify(saved) !== JSON.stringify(incoming)) return fail("Ce thème a changé. Recharge la version enregistrée.", 409);
       return Response.json({ theme: existing }, { headers });
     }
     const slot = Array.from({ length: CUSTOM_THEME_LIMIT }, (_, i) => i + 1).find((n) => !themes.some((t) => t.slot === n));
     if (!slot) return fail("Limite de 5 thèmes atteinte.", 409);
     const { data, error } = await adminClient().from("custom_themes")
       .insert({ ...parsed.data, owner_id: user.id, slot }).select(themeColumns).single();
     if (!error) return Response.json({ theme: data }, { status: 201, headers });
     if (error.code !== "23505") throw error;
   }
   return fail("La bibliothèque a changé. Actualise-la.", 409);
 } catch {
   return fail("Enregistrement du thème impossible. Réessaie.", 503);
 }
}

