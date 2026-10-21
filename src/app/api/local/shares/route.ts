import { z } from "zod";
import { isLocal } from "@/local/runtime";
import { getUser } from "@/local/session";
import { creationList, exportCreation, importCreation } from "@/local/share";
import { sameOrigin } from "@/lib/api";
import { readStore } from "@/local/store";

export const dynamic = "force-dynamic";
const kind = z.enum(["scene","theme","builder"]);
const noCache = { "Cache-Control":"private, no-store" };
export async function GET(request:Request){
 if(!isLocal())return new Response(null,{status:410});
 const user=await getUser();if(!user)return new Response(null,{status:401});
 const params=new URL(request.url).searchParams;
 if(!params.has("kind"))return Response.json(creationList(user.id),{headers:noCache});
 const checked=z.object({kind,id:z.uuid(),format:z.enum(["pokestream","json"]).default("pokestream")}).safeParse(Object.fromEntries(params));
 if(!checked.success)return new Response(null,{status:400});
 try {
  const bundle=await exportCreation(checked.data.kind,checked.data.id,user.id);
  return new Response(JSON.stringify(bundle,null,2),{headers:{...noCache,"Content-Type":"application/json; charset=utf-8", "Content-Disposition":`attachment; filename="PokeStream-${checked.data.kind}-${checked.data.id}.${checked.data.format}"`}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Export impossible"},{status:400,headers:noCache});}
}
export async function POST(request:Request){
 if(!isLocal())return new Response(null,{status:410});
 const user=await getUser();if(!user)return new Response(null,{status:401});
 if(!sameOrigin(request))return new Response(null,{status:403});
 if(Number(request.headers.get("content-length")||0)>48*1024*1024)return new Response(null,{status:413});
 try{
  const text=await request.text();if(Buffer.byteLength(text)>48*1024*1024)return new Response(null,{status:413});
  const body=JSON.parse(text);
  const copy=z.object({action:z.literal("copy"),kind,id:z.uuid(),targetUserId:z.uuid()}).safeParse(body);
  if(copy.success){
    if(!readStore().users.some(u=>u.id===copy.data.targetUserId))return new Response(null,{status:404});
    const bundle=await exportCreation(copy.data.kind,copy.data.id,user.id);
    return Response.json(await importCreation(bundle,copy.data.targetUserId),{status:201,headers:noCache});
  }
  const input=z.object({action:z.literal("import"),bundle:z.unknown()}).safeParse(body);
  if(!input.success)return new Response(null,{status:400});
  return Response.json(await importCreation(input.data.bundle,user.id),{status:201,headers:noCache});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Import impossible"},{status:400,headers:noCache});}
}
