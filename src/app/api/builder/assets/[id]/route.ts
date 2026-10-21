import { getUser } from "@/local/session";
import { readStore,transact } from "@/local/store";
import { assetBytes,saveAsset } from "@/local/assets";
import { sameOrigin } from "@/lib/api";
import { BUILDER_IMAGE_MAX_BYTES,BUILDER_IMAGE_MAX_SIDE } from "@/builder/image-limits";
type Context={params:Promise<{id:string}>};
export async function GET(r:Request,c:Context){const {id}=await c.params,state=readStore();const token=new URL(r.url).searchParams.get("token");
 const user=await getUser(),overlay=token?state.tables.builder_overlays.find(b=>b.view_token===token&&b.enabled):null;
 const allowed=overlay?.data.elements.some(e=>e.type==="image"&&e.properties.assetId===id);
 const asset=state.tables.builder_assets.find(a=>a.id===id&&a.ready&&(token?allowed&&a.owner_id===overlay?.owner_id:a.owner_id===user?.id));
 if(!asset)return new Response(null,{status:404});
 try{return new Response(new Uint8Array(await assetBytes(id)),{headers:{"Content-Type":"image/png","Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});}catch{return new Response(null,{status:404});}
}
export async function PUT(r:Request,c:Context){
 const u=await getUser();if(!u||!sameOrigin(r))return new Response(null,{status:403});const {id}=await c.params;
 const asset=readStore().tables.builder_assets.find(a=>a.id===id&&a.owner_id===u.id&&!a.ready);if(!asset||Date.parse(asset.upload_expires_at)<Date.now())return new Response(null,{status:404});
 if(Number(r.headers.get("content-length"))>BUILDER_IMAGE_MAX_BYTES)return new Response(null,{status:413});
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>BUILDER_IMAGE_MAX_BYTES||bytes.length!==asset.upload_size)return new Response(null,{status:413});
 if(bytes.length<33||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||bytes.toString("ascii",12,16)!=="IHDR")return new Response(null,{status:400});
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>BUILDER_IMAGE_MAX_SIDE||height>BUILDER_IMAGE_MAX_SIDE)return new Response(null,{status:400});
 await saveAsset(id,bytes);transact(s=>{const a=s.tables.builder_assets.find(a=>a.id===id&&a.owner_id===u.id);if(a)Object.assign(a,{ready:true,width,height});});
 return new Response(null,{status:204});
}
