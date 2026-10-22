import "server-only";
import { readStore } from "./store";
import { effectiveScene } from "@/lib/connect";
import { resolveCustomTheme } from "@/themes/custom/resolve";
import { displayBuilder } from "@/builder/server";
import { liveBuilder } from "./builder-live";
export function overlayPayload(token: string) {
 const state=readStore(),scene=state.tables.scenes.find(s=>s.view_token===token&&s.enabled);if(!scene)return null;
 const device=state.tables.connect_devices.find(d=>d.scene_id===scene.id&&d.owner_id===scene.owner_id),themes=state.tables.custom_themes.filter(t=>t.owner_id===scene.owner_id);
 return {data:resolveCustomTheme(effectiveScene(scene.data,device?.snapshot),themes),version:[scene.version,device?.revision??0,...themes.map(t=>t.id+":"+t.version)].join(":")};
}
export async function builderPayload(token: string) {
 const row=readStore().tables.builder_overlays.find(b=>b.view_token===token&&b.enabled);if(!row)return null;
 const result=await displayBuilder(row.owner_id,liveBuilder(row.id,row.owner_id,row.version,row.data));result.data.sceneId=null;return {...result,expiresAt:0};
}
export async function builderPreview(owner: string,id: string,selected: string|null) {
 const state=readStore();if(state.settings.activeUser!==owner)return null;
 const row=state.tables.builder_overlays.find(b=>b.id===id&&b.owner_id===owner);if(!row)return null;
 const data=structuredClone(row.data);data.sceneId=selected==="none"?null:selected??data.sceneId;
 return {...await displayBuilder(owner,data),expiresAt:0};
}
