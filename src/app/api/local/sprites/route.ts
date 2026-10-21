import {isLocal} from "@/local/runtime";
import {localRequestAllowed} from "@/local/request-origin";
import {getUser} from "@/local/session";
import {pauseSpriteDownload,spriteStatus,startSpriteDownload} from "@/local/sprite-library";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){
 if(!isLocal())return new Response(null,{status:410});
 if(!localRequestAllowed(request))return new Response(null,{status:403});
 if(!await getUser())return new Response(null,{status:401});
 return Response.json(spriteStatus(),{headers});
}
export async function POST(request:Request){
 if(!isLocal())return new Response(null,{status:410});
 if(!localRequestAllowed(request,true))return new Response(null,{status:403});
 if(!await getUser())return new Response(null,{status:401});
 const input=await request.json().catch(()=>null);
 if(input?.action==="start")return Response.json(startSpriteDownload(),{headers});
 if(input?.action==="pause")return Response.json(pauseSpriteDownload(),{headers});
 return new Response(null,{status:400});
}
