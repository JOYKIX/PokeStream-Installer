import { listCustomThemes } from "@/themes/custom/server";
import { resolveCustomTheme } from "@/themes/custom/resolve";
import { getTranslations } from "@/i18n/server";
import { getStarter } from "@/themes/server";
import { getAccess } from "@/lib/access";
import { availableTheme } from "@/lib/premium";
import { notFound, redirect } from "next/navigation";
import { createLocalRepository as createClient } from "@/local/repository";
import { getUser } from "@/local/session";
import { sceneSchema } from "@/lib/model";
import { Studio } from "@/components/studio";
import { z } from "zod";
export async function generateMetadata() {
  const tr = await getTranslations();
  return { title: tr("Studio") };
}
export default async function ScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tr = await getTranslations();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const auth = { user: await getUser() };
  if (!auth.user) redirect("/login");
  const [{ data: scene, error }, access, starter, customThemes] =
    await Promise.all([
      supabase
        .from("scenes")
        .select("*, connect_devices(id,name,snapshot,updated_at)")
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .maybeSingle(),
      getAccess(auth.user.id),
      getStarter(auth.user.id),
      listCustomThemes(auth.user.id),
    ]);
  if (error) {
    console.error("[PokeStream] Studio profile query failed", {id, code:error.code, message:error.message});
    throw new Error(tr("Impossible de charger le profil."));
  }
  if (!scene) notFound();
  const parsed = sceneSchema.safeParse(scene.data);
  if (!parsed.success) {
    console.error("[PokeStream] Studio profile validation failed", {
      id,
      issues:parsed.error.issues.map(issue=>({path:issue.path.join("."),code:issue.code}))
    });
    throw new Error(tr("Ce profil contient des données invalides."));
  }
  return (
    <Studio
      grade={access.grade}
      initialData={resolveCustomTheme(
        availableTheme(parsed.data, access.active, starter),
        customThemes,
      )}
      initialCustomThemes={customThemes}
      initialStarter={starter}
      initialDevice={
        Array.isArray(scene.connect_devices)
          ? scene.connect_devices[0]
          : scene.connect_devices
      }
      scene={scene}
    />
  );
}
