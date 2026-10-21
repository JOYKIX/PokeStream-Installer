import "server-only";
import {promises as fs} from "node:fs";
import path from "node:path";
import {gunzipSync} from "node:zlib";
import {randomUUID} from "node:crypto";
import {dataDirectory} from "./store";

// All caches live outside Application so they survive updates, repairs and reinstallation.
const root=()=>path.join(dataDirectory(),"Sprites");
const online="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const indexURL="https://pokeapi.github.io/sprites/manifest.json.gz";
const maxImage=20*1024*1024;
const pending=new Map<string,Promise<Buffer|null>>();
type Status={state:"idle"|"indexing"|"downloading"|"paused"|"done"|"error";done:number;total:number;downloaded:number;skipped:number;failed:number;bytes:number;message:string};
const state:Status={state:"idle",done:0,total:0,downloaded:0,skipped:0,failed:0,bytes:0,message:""};
let shouldStop=false;

export function spritePath(parts:string[]):string|null {
 if(parts.length<1||parts.length>12||parts.some(p=>!p||p==="."||p===".."||!/^[a-zA-Z0-9_.-]{1,110}$/.test(p)))return null;
 const candidate=parts.join("/");
 return candidate.length<=360&&/\.(png|gif|svg)$/i.test(candidate)?candidate:null;
}
async function exists(file:string){
 try{const s=await fs.stat(file);return s.isFile()&&s.size>0&&s.size<=maxImage;}catch{return false;}
}
const destination=(file:string)=>path.join(root(),"pokemon",...file.split("/"));
const packaged=(file:string)=>path.join(process.cwd(),"public","sprites","pokemon",...file.split("/"));
async function fetchImage(file:string):Promise<Buffer|null>{
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(online+file,{signal:AbortSignal.timeout(45000),redirect:"follow",cache:"no-store"});
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
export async function sprite(file:string):Promise<Buffer|null>{
 if(!spritePath(file.split("/")))return null;
 const built=packaged(file);if(await exists(built))return fs.readFile(built);
 const local=destination(file);if(await exists(local))return fs.readFile(local);
 const previous=pending.get(file);if(previous)return previous;
 const promise=(async()=>{
  const data=await fetchImage(file);if(!data)return null;
  await fs.mkdir(path.dirname(local),{recursive:true});
  const temp=local+"."+randomUUID()+".tmp";
  try{await fs.writeFile(temp,data,{flag:"wx"});await fs.rename(temp,local);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  return data;
 })();
 pending.set(file,promise);
 try{return await promise;}finally{pending.delete(file);}
}
export function spriteStatus(){return {...state};}
async function readIndex():Promise<string[]>{
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
 return [...new Set(index.filter((s):s is string=>typeof s==="string"&&s.startsWith("pokemon/")).map(s=>s.slice(8)).filter(s=>!!spritePath(s.split("/"))))];
}
async function run(){
 try{
  const files=await readIndex();
  if(shouldStop){state.state="paused";return;}
  state.total=files.length;state.state="downloading";
  let next=0;
  const worker=async()=>{
   while(!shouldStop&&next<files.length){
    const file=files[next++];
    try{
     if(await exists(destination(file))||await exists(packaged(file)))state.skipped++;
     else{
      const bytes=await sprite(file);
      if(bytes){state.downloaded++;state.bytes+=bytes.length;}
      else state.failed++;
     }
    }catch{state.failed++;}
    state.done++;
   }
  };
  await Promise.all(Array.from({length:6},()=>worker()));
  state.state=shouldStop?"paused":state.failed?"error":"done";
  if(state.failed)state.message=state.failed+" fichiers indisponibles ou en erreur. Relancer reprend les fichiers manquants.";
 }catch(error){state.state="error";state.message=error instanceof Error?error.message:"Unable to download sprites";}
}
export function startSpriteDownload(){
 if(state.state==="downloading"||state.state==="indexing")return spriteStatus();
 shouldStop=false;Object.assign(state,{state:"indexing",done:0,total:0,downloaded:0,skipped:0,failed:0,bytes:0,message:""});
 void run();return spriteStatus();
}
export function pauseSpriteDownload(){shouldStop=true;return spriteStatus();}
