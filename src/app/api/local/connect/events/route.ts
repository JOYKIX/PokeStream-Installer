import { eventStream } from "@/local/events";
import { getUser } from "@/local/session";
import { engineStatus,watchEngine } from "@/local/engine";
import { readDestination } from "@/local/connect";
import { readStore } from "@/local/store";
export const dynamic="force-dynamic";
export async function GET(request:Request) {const user=await getUser();if(!user)return new Response(null,{status:401});const dispose=await watchEngine();return eventStream(request,async()=>readStore().settings.activeUser===user.id?{state:await engineStatus(),target:readDestination()}:null,dispose);}
