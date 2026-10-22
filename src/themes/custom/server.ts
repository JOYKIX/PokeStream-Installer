import "server-only";
import { localRepository as adminClient } from "@/local/repository";
import { customThemeSchema, type CustomTheme } from "./schema";
export const themeColumns = "id,slot,name,config,version,created_at,updated_at";
export async function listCustomThemes(owner: string): Promise<CustomTheme[]> {
  const { data, error } = await adminClient().from("custom_themes").select(themeColumns).eq("owner_id", owner).order("slot");
  if (error) throw new Error("Chargement des thèmes impossible.");
  // Custom themes are user-owned data and may outlive schema changes.
  // Do not make every game profile inaccessible because one old theme is invalid.
  // The stored entry is never removed or overwritten by this read.
  const valid: CustomTheme[] = [];
  for (const row of data ?? []) {
    const parsed = customThemeSchema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else console.error("[PokeStream] Ignoring an incompatible custom theme while loading profiles", {
      id: row?.id,
      issues: parsed.error.issues.map(issue => ({path: issue.path.join("."), code: issue.code})),
    });
  }
  return valid;
}
export async function findCustomTheme(owner: string, id?: string): Promise<CustomTheme | null> {
  if (!id) return null;
  const { data, error } = await adminClient().from("custom_themes").select(themeColumns).eq("owner_id", owner).eq("id", id).maybeSingle();
  if (error) throw new Error("Chargement des thèmes impossible.");
  return data ? customThemeSchema.parse(data) : null;
}

