import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readStore, transact } from "@/local/store";
import { sameOrigin } from "@/lib/api";
import { removeAssetFiles } from "@/local/assets";
export const dynamic = "force-dynamic";
const input = z.object({
  name: z.string().trim().min(1).max(32),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  avatar: z.string().max(600000).regex(/^(data:image\/png;base64,[A-Za-z0-9+/=]+)?$/).default(""),
});
const headers = { "Cache-Control": "private, no-store" };
function failure(error: string, status: number) { return Response.json({ error }, { status, headers }); }
async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 640000) return null;
  const text = await request.text();
  if (Buffer.byteLength(text) > 640000) return null;
  try { return JSON.parse(text); } catch { return null; }
}
function storageFailure(error: unknown) {
  console.error("[local-profiles]", error instanceof Error ? error.message : "Storage error");
  return failure("storage_unavailable", 503);
}
export async function GET() {
  try { const s = readStore(); return Response.json({ users: s.users, active: s.settings.activeUser }, { headers }); }
  catch (error) { return storageFailure(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("origin_refused", 403);
  const parsed = input.safeParse(await body(request));
  if (!parsed.success) return failure("profile_invalid", 400);
  try {
    const user = transact(s => { const u = { id: randomUUID(), ...parsed.data }; s.users.push(u); return u; });
    return Response.json(user, { status: 201, headers });
  } catch (error) { return storageFailure(error); }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return failure("origin_refused", 403);
  const parsed = z.object({ id: z.uuid(), select: z.boolean().optional(), details: input.optional() }).safeParse(await body(request));
  if (!parsed.success) return failure("profile_invalid", 400);
  try {
    const found = transact(s => {
      const u = s.users.find(u => u.id === parsed.data.id); if (!u) return false;
      if (parsed.data.details) Object.assign(u, parsed.data.details);
      if (parsed.data.select) { s.settings.activeUser = u.id; s.settings.epoch = (s.settings.epoch ?? 0) + 1; for (const d of s.tables.connect_devices) d.selection_revision++; }
      return true;
    });
    return found ? new Response(null, { status: 204, headers }) : failure("profile_missing", 404);
  } catch (error) { return storageFailure(error); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return failure("origin_refused", 403);
  const parsed = z.object({ id: z.uuid(), confirm: z.literal(true) }).safeParse(await body(request));
  if (!parsed.success) return failure("profile_invalid", 400);
  try {
    const images = transact(s => {
      const deleted = s.tables.builder_assets.filter(a => a.owner_id === parsed.data.id).map(a => a.id);
      s.users = s.users.filter(u => u.id !== parsed.data.id);
      for (const rows of Object.values(s.tables)) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].owner_id === parsed.data.id) rows.splice(i, 1); }
      if (s.settings.activeUser === parsed.data.id) delete s.settings.activeUser;
      s.settings.epoch = (s.settings.epoch ?? 0) + 1; return deleted;
    });
    await removeAssetFiles(images); return new Response(null, { status: 204, headers });
  } catch (error) { return storageFailure(error); }
}
