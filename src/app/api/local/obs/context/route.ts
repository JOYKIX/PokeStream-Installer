import { engineAuthorized } from "@/local/engine-auth";
import { readStore } from "@/local/store";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!engineAuthorized(request))return new Response(null,{status:401});
 const state=readStore(),owner=state.users.find(u=>u.id===state.settings.activeUser),id=new URL(request.url).searchParams.get("overlay");
 return Response.json({ownerId:owner?.id??null,overlay:id&&owner?state.tables.builder_overlays.find(b=>b.id===id&&b.owner_id===owner.id)?.data??null:null},{headers:{"Cache-Control":"no-store"}});
}
