import { getTranslations } from "@/i18n/server";
import "@/app/privacy/privacy.css";
export async function generateMetadata(){const t=await getTranslations();return {title:t("Confidentialité")};}
export default async function Privacy(){
 const t=await getTranslations();
 const sections=[
  ["Stockage local","Tes profils, équipes, thèmes, overlays et paramètres sont enregistrés sur ton ordinateur."],
  ["Accès à Internet","Les mises à jour et certaines images Pokémon nécessitent une connexion aux services qui les fournissent."],
  ["Partage et sauvegardes","Les fichiers exportés contiennent tes créations et les ressources nécessaires. Tu choisis à qui les transmettre."],
  ["Suppression des données","Supprime un profil depuis l’app, ou désinstalle PokeStream depuis le launcher en désactivant la conservation des données."]
 ];
 return <main id="main" className="document-page privacy-page"><header className="privacy-heading"><h1>{t("Confidentialité")}</h1><p>{t("Une application locale, sans compte ni abonnement.")}</p></header>{sections.map(([title,description])=><section key={title}><h2>{t(title)}</h2><p>{t(description)}</p></section>)}</main>;
}
