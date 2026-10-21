import { getTranslations } from "@/i18n/server";
import { redirect } from "next/navigation";
import { getUser } from "@/local/session";
import { LocalSettings } from "@/local/settings";
import "@/local/settings.css";
export async function generateMetadata(){const t=await getTranslations();return {title:t("Partage et sauvegardes")};}
export default async function Settings(){if(!await getUser())redirect("/users");return <LocalSettings/>;}
