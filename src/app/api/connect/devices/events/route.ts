import { eventStream,engineConnected } from "@/local/events";
import { getUser } from "@/local/session";
import { readStore } from "@/local/store";
export const dynamic="force-dynamic";
export async function GET(request:Request) {const user=await getUser();if(!user)return new Response(null,{status:401});const id=new URL(request.url).searchParams.get("scene");return eventStream(request,()=>{const s=readStore(),device=s.settings.activeUser===user.id?s.tables.connect_devices.find(d=>d.owner_id===user.id&&d.scene_id===id)??null:null;return {device,online:!!device&&engineConnected()};});}
