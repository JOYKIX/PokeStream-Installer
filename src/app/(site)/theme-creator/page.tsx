import { redirect } from "next/navigation";
import { getUser } from "@/local/session";
import { getAccess } from "@/lib/access";
import { getTranslations } from "@/i18n/server";
import { listCustomThemes } from "@/themes/custom/server";
import { createLocalRepository as createClient } from "@/local/repository";
import { effectiveScene } from "@/lib/connect";
import { sceneSchema } from "@/lib/model";
import type { PreviewProfile } from "@/themes/custom/preview";
import { ThemeStudio } from "@/themes/custom/theme-studio";
import "@/themes/custom/studio.css";
export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("Theme Creator") };
}
export default async function ThemeCreatorPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme: initialThemeId } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login?next=/theme-creator");
  const supabase = await createClient();
  const [access, themes, result] = await Promise.all([
    getAccess(user.id),
    listCustomThemes(user.id),
    supabase.from("scenes").select("id, data, connect_devices(snapshot)")
      .eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(20),
  ]);
  const profiles: PreviewProfile[] = (result.data ?? []).flatMap((scene) => {
    const devices = scene.connect_devices;
    const snapshot = Array.isArray(devices) ? devices[0]?.snapshot : undefined;
    const parsed = sceneSchema.safeParse(effectiveScene(scene.data, snapshot));
    return parsed.success ? [{ id: scene.id, name: parsed.data.name, data: parsed.data }] : [];
  });
  return (
    <>
      <ThemeStudio key={initialThemeId ?? "library"} initialThemeId={initialThemeId} initialThemes={themes} active={access.active} profiles={profiles} profilesUnavailable={!!result.error} />
    </>
  );
}
