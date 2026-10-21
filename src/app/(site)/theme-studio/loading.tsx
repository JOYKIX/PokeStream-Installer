import { getTranslations } from "@/i18n/server";
export default async function Loading() {
  const t = await getTranslations();
  return (
    <main className="site-container loading-status" role="status">
      {t("Chargement…")}
    </main>
  );
}
