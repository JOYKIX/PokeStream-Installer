import "server-only";
import {promises as fs} from "node:fs";
import path from "node:path";
import {gunzipSync} from "node:zlib";
import {randomUUID} from "node:crypto";
import {dataDirectory} from "./store";

// Keep the existing per-PC cache layout so downloaded files survive app updates.
const root=()=>path.join(dataDirectory(),"Sprites");
const online="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
const indexURL="https://pokeapi.github.io/sprites/manifest.json.gz";
const maxImage=20*1024*1024;
export const SPRITE_COLLECTIONS=["pokemon","items","types","badges"] as const;
export type SpriteCollection=(typeof SPRITE_COLLECTIONS)[number];
export function isSpriteCollection(value:string):value is SpriteCollection{return SPRITE_COLLECTIONS.some(collection=>collection===value);}
type Status={state:"idle"|"indexing"|"downloading"|"paused"|"done"|"error";done:number;total:number;downloaded:number;skipped:number;failed:number;bytes:number;message:string};
type Shared={pending:Map<string,Promise<Buffer|null>>;state:Status;shouldStop:boolean};
// Share downloads across independently bundled Next.js routes.
const shared=globalThis as typeof globalThis & {pokeStreamSprites?:Shared};
const service=shared.pokeStreamSprites??={pending:new Map(),state:{state:"idle",done:0,total:0,downloaded:0,skipped:0,failed:0,bytes:0,message:""},shouldStop:false};
const state=service.state;

export function spritePath(parts:string[]):string|null {
 if(parts.length<1||parts.length>12||parts.some(p=>!p||p==="."||p===".."||!/^[a-zA-Z0-9_.-]{1,110}$/.test(p)))return null;
 const candidate=parts.join("/");
 return candidate.length<=360&&/\.(png|gif|svg|webp)$/i.test(candidate)?candidate:null;
}
async function exists(file:string){
 try{const stat=await fs.stat(file);return stat.isFile()&&stat.size>0&&stat.size<=maxImage;}catch{return false;}
}
const destination=(file:string,collection:SpriteCollection)=>path.join(root(),collection,...file.split("/"));
const packaged=(file:string,collection:SpriteCollection)=>path.join(process.cwd(),"public","sprites",collection,...file.split("/"));
async function fetchImage(file:string,collection:SpriteCollection):Promise<Buffer|null>{
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(online+collection+"/"+file,{signal:AbortSignal.timeout(15000),redirect:"follow",cache:"no-store"});
   if(response.status===404)return null;
   if(!response.ok)throw Error("PokéAPI HTTP "+response.status);
   const declared=Number(response.headers.get("content-length")||0);
   if(declared>maxImage)throw Error("Sprite too large");
   const data=Buffer.from(await response.arrayBuffer());
   if(!data.length||data.length>maxImage)throw Error("Invalid sprite size");
   return data;
  }catch(error){if(attempt===2)throw error;await new Promise(done=>setTimeout(done,500*(attempt+1)));}
 }
 return null;
}
export async function sprite(file:string,collection:SpriteCollection="pokemon"):Promise<Buffer|null>{
 if(!isSpriteCollection(collection)||!spritePath(file.split("/")))return null;
 // The downloaded library takes priority over the older bundled starter pack.
 const local=destination(file,collection);if(await exists(local))return fs.readFile(local);
 const built=packaged(file,collection);if(await exists(built))return fs.readFile(built);
 const key=collection+"/"+file,previous=service.pending.get(key);if(previous)return previous;
 const promise=(async()=>{
  const data=await fetchImage(file,collection);if(!data)return null;
  await fs.mkdir(path.dirname(local),{recursive:true});
  const temp=local+"."+randomUUID()+".tmp";
  try{await fs.writeFile(temp,data,{flag:"wx"});await fs.rename(temp,local);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  return data;
 })();
 service.pending.set(key,promise);
 try{return await promise;}finally{service.pending.delete(key);}
}
export function spriteStatus(){return {...state};}
async function readIndex():Promise<{file:string;collection:SpriteCollection}[]>{
 const indexPath=path.join(process.cwd(),"public","sprites","manifest.json.gz");
 let buffer:Buffer;
 try{buffer=await fs.readFile(indexPath);}catch{
  const response=await fetch(indexURL,{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error("PokéAPI index HTTP "+response.status);
  buffer=Buffer.from(await response.arrayBuffer());
 }
 if(buffer.length>32*1024*1024)throw Error("Sprite index too large");
 const index:unknown=JSON.parse(gunzipSync(buffer,{maxOutputLength:100*1024*1024}).toString("utf8"));
 if(!Array.isArray(index)||index.length<15000)throw Error("Sprite index incomplete");
 const entries:{file:string;collection:SpriteCollection}[]=[];
 for(const value of new Set(index)){
  if(typeof value!=="string")continue;
  const [collection,...parts]=value.split("/"),file=spritePath(parts);
  if(isSpriteCollection(collection)&&file)entries.push({collection,file});
 }
 return entries;
}
async function run(){
 try{
  const files=await readIndex();
  if(service.shouldStop){state.state="paused";return;}
  state.total=files.length;state.state="downloading";
  let next=0;
  const worker=async()=>{
   while(!service.shouldStop&&next<files.length){
    const {file,collection}=files[next++];
    try{
     if(await exists(destination(file,collection))||await exists(packaged(file,collection)))state.skipped++;
     else{
      const bytes=await sprite(file,collection);
      if(bytes){state.downloaded++;state.bytes+=bytes.length;}else state.failed++;
     }
    }catch{state.failed++;}
    state.done++;
   }
  };
  await Promise.all(Array.from({length:6},()=>worker()));
  state.state=service.shouldStop?"paused":state.failed?"error":"done";
  if(state.failed)state.message="Certains sprites sont indisponibles. Reprends pour récupérer les fichiers manquants.";
 }catch(error){state.state="error";state.message=error instanceof Error?error.message:"Unable to download sprites";}
}
export function startSpriteDownload(){
 if(state.state==="downloading"||state.state==="indexing")return spriteStatus();
 service.shouldStop=false;Object.assign(state,{state:"indexing",done:0,total:0,downloaded:0,skipped:0,failed:0,bytes:0,message:""});
 void run();return spriteStatus();
}
export function pauseSpriteDownload(){service.shouldStop=true;return spriteStatus();}
