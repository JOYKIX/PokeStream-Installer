import "server-only";
import { localRepository as adminClient } from "@/local/repository";
import { customThemeSchema, type CustomTheme } from "./schema";
export const themeColumns = "id,slot,name,config,version,created_at,updated_at";
export async function listCustomThemes(owner: string): Promise<CustomTheme[]> {
  const { data, error } = await adminClient().from("custom_themes").select(themeColumns).eq("owner_id", owner).order("slot");
  if (error) throw new Error("Chargement des thèmes impossible.");
  return customThemeSchema.array().parse(data ?? []);
}
export async function findCustomTheme(owner: string, id?: string): Promise<CustomTheme | null> {
  if (!id) return null;
  const { data, error } = await adminClient().from("custom_themes").select(themeColumns).eq("owner_id", owner).eq("id", id).maybeSingle();
  if (error) throw new Error("Chargement des thèmes impossible.");
  return data ? customThemeSchema.parse(data) : null;
}

