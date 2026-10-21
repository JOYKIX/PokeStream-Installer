import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getUser } from "@/local/session";
import { readStore,transact } from "@/local/store";
import { sameOrigin } from "@/lib/api";
import { cleanupAssets } from "@/local/assets";
import { BUILDER_IMAGE_MAX_BYTES } from "@/builder/image-limits";
export async function GET(){const u=await getUser();if(!u)return new Response(null,{status:401});return Response.json({assets:await cleanupAssets(u.id)},{headers:{"Cache-Control":"no-store"}});}
export async function POST(r:Request){
 const u=await getUser();if(!u||!sameOrigin(r))return new Response(null,{status:403});
 const p=z.object({name:z.string().trim().min(1).max(100),size:z.number().int().min(24).max(BUILDER_IMAGE_MAX_BYTES)}).safeParse(await r.json().catch(()=>null));if(!p.success)return new Response(null,{status:400});
 const id=randomUUID();transact(s=>{s.tables.builder_assets.push({id,owner_id:u.id,slot:Date.now(),name:p.data.name,object_path:id+".png",width:1,height:1,ready:false,upload_size:p.data.size,upload_expires_at:new Date(Date.now()+3600000).toISOString(),created_at:new Date().toISOString()});});
 return Response.json({uploadId:id,uploadUrl:"/api/builder/assets/"+id},{status:201});
}
