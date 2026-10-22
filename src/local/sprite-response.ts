import "server-only";
import {isLocal} from "./runtime";
import {localRequestAllowed} from "./request-origin";
import {isSpriteCollection,sprite,spritePath} from "./sprite-library";
const mime:Record<string,string>={png:"image/png",gif:"image/gif",svg:"image/svg+xml",webp:"image/webp"};
export async function spriteResponse(request:Request,collection:string,parts:string[]){
 if(!isLocal())return new Response(null,{status:410});
 if(!localRequestAllowed(request))return new Response(null,{status:403});
 if(!isSpriteCollection(collection))return new Response(null,{status:404});
 const file=spritePath(parts);
 if(!file)return new Response(null,{status:400});
 try{
  const buffer=await sprite(file,collection,new URL(request.url).searchParams.get("local")==="1");
  if(!buffer)return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
  return new Response(new Uint8Array(buffer),{headers:{
   "Content-Type":mime[file.split(".").pop()!.toLowerCase()],"Content-Length":String(buffer.length),
   "Cache-Control":"private, max-age=86400","X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox"
  }});
 }catch{return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}});}
}
