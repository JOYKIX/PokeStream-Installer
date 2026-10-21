import { getUser } from "@/local/session";
import { readStore } from "@/local/store";
import { sameOrigin } from "@/lib/api";
export async function POST(r:Request,c:{params:Promise<{id:string}>}){const u=await getUser();if(!u||!sameOrigin(r))return new Response(null,{status:403});const {id}=await c.params;const a=readStore().tables.builder_assets.find(a=>a.id===id&&a.owner_id===u.id&&a.ready);return a?Response.json({asset:{id:a.id,name:a.name,width:a.width,height:a.height}}):new Response(null,{status:404});}
