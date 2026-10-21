import { z } from "zod";
import { getUser } from "@/local/session";
import { localRepository as adminClient } from "@/local/repository";
import { displayBuilder, builderHeaders } from "@/builder/server";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  try {
    const { data, error } = await adminClient()
      .from("builder_overlays")
      .select("data")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response(null, { status: 404 });
    const selected = new URL(request.url).searchParams.get("scene");
    if (selected === "none") data.data.sceneId = null;
    else if (selected && z.uuid().safeParse(selected).success)
      data.data.sceneId = selected;
    return Response.json(await displayBuilder(user.id, data.data), {
      headers: builderHeaders,
    });
  } catch {
    return new Response(null, { status: 503, headers: builderHeaders });
  }
}
