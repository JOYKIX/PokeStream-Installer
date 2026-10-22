import { engineAuthorized } from "@/local/engine-auth";
import { readStore } from "@/local/store";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!engineAuthorized(request))return new Response(null,{status:401});
 const state=readStore(),owner=state.users.find(u=>u.id===state.settings.activeUser),id=new URL(request.url).searchParams.get("overlay");
 const row=id&&owner?state.tables.builder_overlays.find(b=>b.id===id&&b.owner_id===owner.id):null;
 return Response.json({viewToken:row?.view_token??null,enabled:row?.enabled??false,version:row?.version??0,ownerId:owner?.id??null,overlay:row?.data??null},{headers:{"Cache-Control":"no-store"}});
}
