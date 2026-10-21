import { z } from "zod";
import { getUser } from "@/local/session";
import { localRepository as adminClient } from "@/local/repository";
import { readJson, sameOrigin } from "@/lib/api";
import { getTranslations } from "@/i18n/server";
import { themeInputSchema } from "@/themes/custom/schema";
import { themeColumns } from "@/themes/custom/server";
const headers = { "Cache-Control": "private, no-store" };
const updateSchema = themeInputSchema.extend({ version: z.number().int().positive() });
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
 const tr = await getTranslations();
 const fail = (key: string, status: number) => Response.json({ error: tr(key) }, { status, headers });
 if (!sameOrigin(request)) return fail("Origine refusée.", 403);
 const user = await getUser();
 if (!user) return fail("Session expirée. Reconnecte-toi.", 401);
 const { id } = await context.params;
 if (!z.uuid().safeParse(id).success) return fail("Thème introuvable.", 404);
 const parsed = updateSchema.safeParse(await readJson(request).catch(() => null));
 if (!parsed.success) return fail("Vérifie le nom et les réglages du thème.", 400);
 try {
   const { version, ...input } = parsed.data;
   const { data, error } = await adminClient().from("custom_themes")
     .update({ ...input, version: version + 1, updated_at: new Date().toISOString() })
     .eq("id", id).eq("owner_id", user.id).eq("version", version).select(themeColumns).maybeSingle();
   if (error) throw error;
   if (!data) return fail("Ce thème a changé. Recharge la version enregistrée.", 409);
   return Response.json({ theme: data }, { headers });
 } catch {
   return fail("Enregistrement du thème impossible. Réessaie.", 503);
 }
}
export async function DELETE(request: Request, context: Context) {
 const tr = await getTranslations();
 const fail = (key: string, status: number) => Response.json({ error: tr(key) }, { status, headers });
 if (!sameOrigin(request)) return fail("Origine refusée.", 403);
 const user = await getUser();
 if (!user) return fail("Session expirée. Reconnecte-toi.", 401);
 const { id } = await context.params;
 const parsed = z.object({ version: z.number().int().positive() }).strict().safeParse(await readJson(request).catch(() => null));
 if (!z.uuid().safeParse(id).success || !parsed.success) return fail("Paramètres invalides.", 400);
 try {
   // Owners can remove their saved data even after premium access expires.
   const { data, error } = await adminClient().from("custom_themes").delete()
     .eq("id", id).eq("owner_id", user.id).eq("version", parsed.data.version).select("id").maybeSingle();
   if (error) throw error;
   if (!data) return fail("Ce thème a changé. Recharge la version enregistrée.", 409);
   return Response.json({ deleted: true }, { headers });
 } catch {
   return fail("Suppression du thème impossible.", 503);
 }
}

