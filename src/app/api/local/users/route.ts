import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readStore,transact } from "@/local/store";
import { sameOrigin } from "@/lib/api";
import { removeAssetFiles } from "@/local/assets";
const input=z.object({name:z.string().trim().min(1).max(32),color:z.string().regex(/^#[0-9a-f]{6}$/i),avatar:z.string().max(600000).regex(/^(data:image\/png;base64,[A-Za-z0-9+/=]+)?$/)});
export async function GET(){const s=readStore();return Response.json({users:s.users,active:s.settings.activeUser},{headers:{"Cache-Control":"no-store"}});}
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const p=input.safeParse(await request.json().catch(()=>null));if(!p.success)return new Response(null,{status:400});
 const user=transact(s=>{const u={id:randomUUID(),...p.data};s.users.push(u);return u;});return Response.json(user,{status:201});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const p=z.object({id:z.uuid(),select:z.boolean().optional(),details:input.optional()}).safeParse(await request.json().catch(()=>null));
 if(!p.success)return new Response(null,{status:400});
 const found=transact(s=>{const u=s.users.find(u=>u.id===p.data.id);if(!u)return false;
 if(p.data.details)Object.assign(u,p.data.details);
 if(p.data.select){s.settings.activeUser=u.id;s.settings.epoch=(s.settings.epoch??0)+1;for(const d of s.tables.connect_devices){d.selection_revision++;}}
 return true;});return new Response(null,{status:found?204:404});
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const p=z.object({id:z.uuid(),confirm:z.literal(true)}).safeParse(await request.json().catch(()=>null));if(!p.success)return new Response(null,{status:400});
 const images=transact(s=>{const deleted=s.tables.builder_assets.filter(a=>a.owner_id===p.data.id).map(a=>a.id);
 s.users=s.users.filter(u=>u.id!==p.data.id);for(const rows of Object.values(s.tables)){for(let i=rows.length-1;i>=0;i--)if(rows[i].owner_id===p.data.id)rows.splice(i,1);}
 if(s.settings.activeUser===p.data.id)delete s.settings.activeUser;s.settings.epoch=(s.settings.epoch??0)+1;return deleted;});
 await removeAssetFiles(images);
 return new Response(null,{status:204});
}
