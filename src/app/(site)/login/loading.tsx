import { getTranslations } from "@/i18n/server";
import { PageLoading } from "@/components/page-loading";
export default async function Loading() {
  const tr = await getTranslations();
  return <PageLoading variant="auth" title={tr("Connexion")} />;
}
