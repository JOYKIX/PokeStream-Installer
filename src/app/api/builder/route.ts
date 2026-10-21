import { z } from "zod";
import { getUser } from "@/local/session";
import { sameOrigin } from "@/lib/api";
import { localRepository as adminClient } from "@/local/repository";
import { getAccess } from "@/lib/access";
import { getTranslations } from "@/i18n/server";
import { builderSchema } from "@/builder/schema";
import {
  BuilderError,
  builderColumns,
  builderHeaders,
  listBuilders,
  validateBuilder,
} from "@/builder/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  try {
    return Response.json(
      { overlays: await listBuilders(user.id) },
      { headers: builderHeaders },
    );
  } catch {
    return new Response(null, { status: 503 });
  }
}
export async function POST(request: Request) {
  const t = await getTranslations(),
    fail = (key: string, status: number) =>
      Response.json({ error: t(key) }, { status, headers: builderHeaders });
  if (!sameOrigin(request)) return fail("Origine refusée.", 403);
  const user = await getUser();
  if (!user) return fail("Session expirée. Reconnecte-toi.", 401);
  const body = await request.text();
  if (body.length > 240000) return fail("Création invalide.", 413);
  const input = z
    .object({ id: z.uuid(), data: builderSchema })
    .strict()
    .safeParse(
      (() => {
        try {
          return JSON.parse(body);
        } catch {
          return null;
        }
      })(),
    );
  if (!input.success) return fail("Création invalide.", 400);
  try {
    await validateBuilder(user.id, input.data.data);
    const access = await getAccess(user.id);
    if (access.state === "unavailable")
      throw new BuilderError("Vérification temporairement indisponible.", 503);
    const limit = access.active ? 15 : 3;
    for (let attempt = 0; attempt < limit; attempt++) {
      const all = await listBuilders(user.id),
        existing = all.find((o) => o.id === input.data.id);
      if (existing) {
        if (
          JSON.stringify(builderSchema.parse(existing.data)) !==
          JSON.stringify(input.data.data)
        )
          throw new BuilderError(
            "La création a changé. Recharge la page.",
            409,
          );
        return Response.json(
          { overlay: existing },
          { headers: builderHeaders },
        );
      }
      if (all.length >= limit)
        throw new BuilderError("Limite de créations atteinte.", 409);
      const slot = Array.from({ length: limit }, (_, i) => i + 1).find(
        (s) => !all.some((o) => o.slot === s),
      );
      if (!slot) throw new BuilderError("Limite de créations atteinte.", 409);
      const { data, error } = await adminClient()
        .from("builder_overlays")
        .insert({ ...input.data, owner_id: user.id, slot })
        .select(builderColumns)
        .single();
      if (!error)
        return Response.json(
          { overlay: data },
          { status: 201, headers: builderHeaders },
        );
      if (error.code !== "23505") throw error;
    }
    throw new BuilderError("La création a changé. Recharge la page.", 409);
  } catch (e) {
    return fail(
      e instanceof BuilderError ? e.message : "Enregistrement impossible.",
      e instanceof BuilderError ? e.status : 503,
    );
  }
}
