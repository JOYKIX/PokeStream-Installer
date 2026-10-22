import "server-only";
import type { BuilderData } from "@/builder/schema";
import { publishLocalChange } from "./events";
export type LiveBox={id:string;x:number;y:number;width:number;height:number;rotation:number;visible:boolean};
type Live={owner:string;session:string;sequence:number;version:number;elements:LiveBox[];boundIds:string[]};
const shared=globalThis as typeof globalThis&{pokeStreamBuilderLive?:Map<string,Live>;pokeStreamBuilderClosed?:Set<string>};
const drafts=()=>shared.pokeStreamBuilderLive??=new Map<string,Live>();
const closed=()=>shared.pokeStreamBuilderClosed??=new Set<string>();
export function setLiveGeometry(id:string,value:Live){if(closed().has(value.session))return;const old=drafts().get(id);if(old?.session===value.session&&old.sequence>=value.sequence)return;if(JSON.stringify(old?.elements)===JSON.stringify(value.elements)&&JSON.stringify(old?.boundIds)===JSON.stringify(value.boundIds)&&old?.version===value.version){drafts().set(id,value);return;}drafts().set(id,value);publishLocalChange();}
export function clearLiveGeometry(id:string,session?:string){if(session){const ended=closed();ended.add(session);if(ended.size>512)ended.delete(ended.values().next().value!);}const value=drafts().get(id);if(value&&(!session||session===value.session)){drafts().delete(id);publishLocalChange();}}
export function liveBuilder(id:string,owner:string,version:number,data:BuilderData):BuilderData {const live=drafts().get(id);if(!live||live.owner!==owner||live.version!==version)return data;return {...data,elements:data.elements.map(e=>{if(!['game-screen','camera','chat'].includes(e.type))return e;const box=live.elements.find(b=>b.id===e.id);return box?{...e,...box}:live.boundIds.includes(e.id)?{...e,visible:false}:e;})};}
