"use client";
import { useI18n } from "@/i18n/client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t: tr } = useI18n();
  return (
    <main className="center-page">
      <h1>{tr("Une erreur est survenue.")}</h1>
      <p>{tr("Ton aventure reste sauvegardée.")}</p>
      <button className="button primary" onClick={reset}>
        {tr("Réessayer")}</button>
    </main>
  );
}
