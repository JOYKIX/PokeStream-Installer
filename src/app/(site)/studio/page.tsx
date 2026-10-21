import { getTranslations } from "@/i18n/server";
import { getStarter } from "@/themes/server";
import { effectiveScene } from "@/lib/connect";
import { createLocalRepository as createClient } from "@/local/repository";
import { getUser } from "@/local/session";
import { Dashboard } from "@/components/dashboard";
import { redirect } from "next/navigation";
import { sceneSchema, type Scene } from "@/lib/model";
export async function generateMetadata() {
  const tr = await getTranslations();
  return { title: tr("Mes profils") };
}
export default async function StudioHome() {
  const tr = await getTranslations();
  const supabase = await createClient();
  const auth = { user: await getUser() };
  if (!auth.user) redirect("/login");
  const [{ data, error }, starter] = await Promise.all([
    supabase
      .from("scenes")
      .select("*, connect_devices(snapshot)")
      .eq("owner_id", auth.user.id)
      .order("updated_at", { ascending: false }),
    getStarter(auth.user.id),
  ]);
  if (error) {
    console.error("Scene list failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error(tr("Impossible de charger les profils."));
  }
  const scenes = (data ?? [])
    .map((s) => {
      const devices = (s as typeof s & {connect_devices?: {snapshot:unknown}[]}).connect_devices;
      return {
      ...s,
      data: effectiveScene(
        s.data,
        devices?.[0]?.snapshot,
      ),
      };
    })
    .filter((s) => sceneSchema.safeParse(s.data).success) as Scene[];
  return <Dashboard scenes={scenes} initialStarter={starter} />;
}
