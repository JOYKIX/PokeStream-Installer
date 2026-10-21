import { getTranslations } from "@/i18n/server";
import { Studio } from "@/components/studio";
import { demoScene } from "@/lib/demo";
export async function generateMetadata() {
  const tr = await getTranslations();
  return { title: tr("Studio démo") };
}
export default function Demo() {
  return <Studio initialData={demoScene()} demo />;
}
