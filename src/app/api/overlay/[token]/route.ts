import { readStore } from "@/local/store";
import { effectiveScene } from "@/lib/connect";
import { resolveCustomTheme } from "@/themes/custom/resolve";
export const dynamic="force-dynamic";
export async function GET(_r:Request,c:{params:Promise<{token:string}>}){
 const {token}=await c.params,state=readStore(),s=state.tables.scenes.find(s=>s.view_token===token&&s.enabled);
 if(!s)return Response.json(null,{headers:{"Cache-Control":"no-store"}});
 const d=state.tables.connect_devices.find(d=>d.scene_id===s.id&&d.owner_id===s.owner_id);
 const themes=state.tables.custom_themes.filter(t=>t.owner_id===s.owner_id);
 return Response.json({data:resolveCustomTheme(effectiveScene(s.data,d?.snapshot),themes),version:[s.version,d?.revision??0,...themes.map(t=>t.id+":"+t.version)].join(":")},{headers:{"Cache-Control":"no-store"}});
}
