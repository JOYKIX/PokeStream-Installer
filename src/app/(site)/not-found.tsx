import { getTranslations } from "@/i18n/server";
import Link from "next/link";
export default async function NotFound() {
  const tr = await getTranslations();
  return (
    <main className="center-page">
      <span className="eyebrow">404</span>
      <h1>{tr("Hors du Pokédex.")}</h1>
      <p>{tr("Cette page est introuvable.")}</p>
      <Link href="/" className="button primary">
        {tr("Retour à l’accueil")}
      </Link>
    </main>
  );
}
