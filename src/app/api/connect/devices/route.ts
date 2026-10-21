import { getUser } from "@/local/session";
import { readStore } from "@/local/store";
import { selectDestination } from "@/local/connect";
import { sameOrigin } from "@/lib/api";
export async function GET(r:Request){const u=await getUser();if(!u)return new Response(null,{status:401});const id=new URL(r.url).searchParams.get("scene");return Response.json(readStore().tables.connect_devices.find(d=>d.owner_id===u.id&&d.scene_id===id)??null,{headers:{"Cache-Control":"no-store"}});}
export async function DELETE(r:Request){if(!sameOrigin(r)||!await getUser())return new Response(null,{status:403});selectDestination(null);return Response.json({ok:true});}
