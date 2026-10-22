import "server-only";
import path from "node:path";
import { watch, type FSWatcher } from "node:fs";
import { readFile,writeFile,mkdir,rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dataDirectory } from "./store";
import { engineConnected,publishLocalChange } from "./events";
export function ipcDirectory(){return process.env.POKESTREAM_IPC_DIR||path.join(dataDirectory(),"engine");}
export async function engineStatus(){try {const file=JSON.parse(await readFile(path.join(ipcDirectory(),"status.json"),"utf8"));return {...file,available:engineConnected()};}catch{return {available:false,paused:false,emulators:[],activity:[],reading:"En attente",game:"Aucun jeu détecté",ryujinxPort:0,citronPort:0};}}
type WatchState={watcher:FSWatcher;users:number;timer?:ReturnType<typeof setTimeout>};
const shared=globalThis as typeof globalThis&{pokeStreamEngineWatch?:WatchState};
export async function watchEngine(){
 await mkdir(ipcDirectory(),{recursive:true});
 if(!shared.pokeStreamEngineWatch){const state:WatchState={watcher:watch(ipcDirectory(),(_event,name)=>{if(name?.toString()!=="status.json")return;clearTimeout(state.timer);state.timer=setTimeout(()=>publishLocalChange("engine"),10);}),users:0};state.watcher.on("error",()=>{state.watcher.close();if(shared.pokeStreamEngineWatch===state)delete shared.pokeStreamEngineWatch;publishLocalChange();});shared.pokeStreamEngineWatch=state;}
 const state=shared.pokeStreamEngineWatch;state.users++;
 return ()=>{if(--state.users===0){clearTimeout(state.timer);state.watcher.close();if(shared.pokeStreamEngineWatch===state)delete shared.pokeStreamEngineWatch;}};
}
export async function engineCommand(command:{action:string;value?:unknown}){
 await mkdir(ipcDirectory(),{recursive:true});const id=randomUUID(),filename=path.join(ipcDirectory(),"command.json"),temp=filename+"."+id;
 await writeFile(temp,JSON.stringify({id,...command}));await rename(temp,filename);return id;
}
