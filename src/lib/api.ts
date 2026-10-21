import { createLocalRepository as createClient } from "@/local/repository";
import { getUser } from "@/local/session";
export async function authenticated() {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);
  return { supabase, user };
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 24000)
    throw new Error("Payload too large");
  const text = await request.text();
  if (text.length > 24000) throw new Error("Payload too large");
  return JSON.parse(text) as unknown;
}
