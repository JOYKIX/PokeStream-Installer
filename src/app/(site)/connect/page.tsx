import "@/local/workspace.css";
import {redirect} from "next/navigation";
import {getUser} from "@/local/session";
import {LocalConnect} from "@/local/connect-panel";
export const metadata={title:"Connect"};
export default async function Page(){if(!await getUser())redirect("/users");return <LocalConnect/>;}
