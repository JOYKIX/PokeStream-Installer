import { redirect } from "next/navigation";
import { getUser } from "@/local/session";
import { LocalSettings } from "@/local/settings";
import "@/local/settings.css";
export const metadata={title:"Partage & sauvegardes — PokeStream"};
export default async function Settings(){if(!await getUser())redirect("/users");return <LocalSettings/>;}
