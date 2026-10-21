import { z } from "zod";
import { localRepository as adminClient } from "@/local/repository";
import { displayBuilder, builderHeaders } from "@/builder/server";
export const dynamic = "force-dynamic";
export async function GET(
  _r: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!z.uuid().safeParse(token).success)
    return new Response(null, { status: 404 });
  try {
    const { data, error } = await adminClient()
      .from("builder_overlays")
      .select("data,owner_id")
      .eq("view_token", token)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return new Response(null, { status: 404, headers: builderHeaders });
    const result = await displayBuilder(data.owner_id, data.data);
    // Remove editor-only source IDs. The token grants display access, not access to the Studio.
    result.data.sceneId = null;
    return Response.json(result, { headers: builderHeaders });
  } catch {
    return new Response(null, { status: 503, headers: builderHeaders });
  }
}
