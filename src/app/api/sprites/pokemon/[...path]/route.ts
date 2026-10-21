import {isLocal} from "@/local/runtime";
import {localRequestAllowed} from "@/local/request-origin";
import {sprite,spritePath} from "@/local/sprite-library";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
 if(!isLocal())return new Response(null,{status:410});
 if(!localRequestAllowed(request))return new Response(null,{status:403});
 const file=spritePath((await params).path);
 if(!file)return new Response(null,{status:400});
 try{
  const buffer=await sprite(file);
  if(!buffer)return new Response(null,{status:404});
  const type=file.endsWith(".gif")?"image/gif":file.endsWith(".svg")?"image/svg+xml":"image/png";
  return new Response(new Uint8Array(buffer),{headers:{"Content-Type":type,"Content-Length":String(buffer.length),"Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"}});
 }catch{return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}});}
}
