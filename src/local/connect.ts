import "server-only";
import { randomUUID } from "node:crypto";
import { readStore,transact,type Store,type LocalDevice } from "./store";
import { snapshotSchema,effectiveScene } from "@/lib/connect";
export function activeDevice(state:Store){
 const owner=state.settings.activeUser;if(!owner||!state.users.some(u=>u.id===owner))return null;
 let d=state.tables.connect_devices.find(d=>d.owner_id===owner);
 if(!d){d={id:randomUUID(),owner_id:owner,name:"Connect",scene_id:null,snapshot:null,revision:0,selection_revision:0,secret_hash:"",created_at:new Date().toISOString(),updated_at:null,last_seen_at:null};state.tables.connect_devices.push(d);}
 return d;
}
function status(state:Store,d:LocalDevice|null){
 const scene=state.tables.scenes.find(s=>s.id===d?.scene_id&&s.owner_id===d.owner_id);
 return {scene:scene?.data.name??null,sceneId:scene?.id??null,nuzlocke:scene?.data.nuzlocke??false,
 selectionRevision:(state.settings.epoch??0)*1000000+(d?.selection_revision??0),
 deaths:scene?effectiveScene(scene.data,d?.snapshot).deaths:0,
 overlays:state.tables.scenes.filter(s=>s.owner_id===state.settings.activeUser).map(s=>({id:s.id,name:s.data.name,game:s.data.game,inUse:false}))};
}
export function readDestination(){return transact(state=>status(state,activeDevice(state)));}
export function selectDestination(id:string|null,expected?:number){
 return transact(state=>{const d=activeDevice(state);if(!d)return {error:"scene_missing"};
 if(expected!==undefined&&expected!==status(state,d).selectionRevision)return {error:"scene_changed"};
 if(id&&!state.tables.scenes.some(s=>s.id===id&&s.owner_id===d.owner_id))return {error:"scene_missing"};
 if(d.scene_id!==id){const previous=state.tables.scenes.find(s=>s.id===d.scene_id&&s.owner_id===d.owner_id);
 if(previous&&d.snapshot){previous.data=effectiveScene(previous.data,d.snapshot);previous.version++;previous.updated_at=new Date().toISOString();}
 d.scene_id=id;d.snapshot=null;d.revision++;d.selection_revision++;d.updated_at=null;}
 return status(state,d);
 });
}
export function ingestFrame(raw:unknown,sceneId:string|undefined,revision:number){
 return transact(state=>{const d=activeDevice(state);if(!d)return {error:"scene_changed"};
 const current=status(state,d);if(sceneId!==current.sceneId||revision!==current.selectionRevision)return {error:"scene_changed"};
 const s=state.tables.scenes.find(s=>s.id===sceneId&&s.owner_id===d.owner_id);if(!s)return {error:"scene_changed"};
 const previous=snapshotSchema.safeParse(d.snapshot);
 const incoming=raw as Record<string,unknown>;
 const merged={...(previous.success?previous.data:{}),...incoming};
 if(!s.data.nuzlocke)delete merged.deaths;
 const parsed=snapshotSchema.safeParse(merged);if(!parsed.success)throw new Error("Invalid snapshot");
 const now=new Date().toISOString();d.last_seen_at=now;
 if(JSON.stringify(parsed.data)!==JSON.stringify(d.snapshot)){d.snapshot=parsed.data;d.revision++;d.updated_at=now;}
 return status(state,d);
 });
}
export function touchDestination(){return transact(state=>{const d=activeDevice(state);if(d)d.last_seen_at=new Date().toISOString();return status(state,d);});}
