import {eventStream} from "@/local/events";
import {getUser} from "@/local/session";
import {readStore} from "@/local/store";
import {listCustomThemes} from "@/themes/custom/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){const user=await getUser();if(!user)return new Response(null,{status:401});return eventStream(request,async()=>({themes:readStore().settings.activeUser===user.id?await listCustomThemes(user.id):[]}),undefined,["themes"]);}
