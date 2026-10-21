#!/usr/bin/env node
// Index every Pokémon asset listed in the upstream PokéAPI sprites manifest.
// The complete graphics repository is >10 GB: files are cached on each user's PC,
// not committed to PokeStream or shipped wholesale inside its installer.
import {readFile,writeFile,mkdir,stat} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
import path from "node:path";

const manifestURL="https://pokeapi.github.io/sprites/manifest.json.gz";
const response=await fetch(manifestURL,{signal:AbortSignal.timeout(90000)});
if(!response.ok)throw new Error("PokéAPI sprite manifest unavailable: HTTP "+response.status);
const compressed=Buffer.from(await response.arrayBuffer());
if(compressed.length>32*1024*1024)throw new Error("PokéAPI manifest too large");
const raw=gunzipSync(compressed,{maxOutputLength:100*1024*1024});
const index=JSON.parse(raw.toString("utf8"));
if(!Array.isArray(index)||index.length<15000||!index.every(s=>typeof s==="string"))throw new Error("Invalid/incomplete PokéAPI sprite index");
const sources=JSON.parse(await readFile("src/data/sprite-sources.json","utf8"));
const priorAvailability=JSON.parse(await readFile("src/data/sprite-availability.json","utf8"));
const entries=index.filter(p=>p.startsWith("pokemon/")&&/\.(png|gif|svg|webp)$/i.test(p));
if(entries.length<15000)throw new Error("PokéAPI Pokémon sprite index unexpectedly incomplete");
const available={},forms={};
const validDir=new Set(["","back","female","shiny","transparent","gray","gbc"]);
for(const source of sources){
  const prefix="pokemon/"+(source.path?source.path+"/":"");
  const directories=new Map();
  for(const file of entries){
    if(!file.startsWith(prefix)||!file.endsWith("."+source.extension))continue;
    const relative=file.slice(prefix.length);
    const cut=relative.lastIndexOf("/");
    const dir=cut<0?"":relative.slice(0,cut);
    if(dir.split("/").some(part=>!validDir.has(part)))continue;
    const name=relative.slice(cut+1,-(source.extension.length+1));
    if(/^\d+$/.test(name)){
      if(!directories.has(dir))directories.set(dir,[]);
      directories.get(dir).push(Number(name));
    }else if(/^\d+-[a-z0-9-]+$/.test(name)){
      const spriteForm=forms[name]??={};
      const dirs=spriteForm[source.id]??=[];
      if(!dirs.includes(dir))dirs.push(dir);
    }
  }
  const map={};
  for(const [dir,list] of directories){
    const unique=[...new Set(list)].sort((a,b)=>a-b),ranges=[];
    for(const n of unique){const last=ranges.at(-1);if(last&&n===last[1]+1)last[1]=n;else ranges.push([n,n]);}
    map[dir]=ranges;
  }
  if(!Object.keys(map).length){
    if(!priorAvailability[source.id])throw new Error("No fallback availability for "+source.id);
    console.warn("[PokeStream] Source missing in current PokéAPI manifest: "+source.id+"; keeping previous mapping.");
    available[source.id]=priorAvailability[source.id];
  }else available[source.id]=map;
}
// Retain known historical form-to-sprite mappings for collections omitted from the upstream index.
const previousForms=JSON.parse(await readFile("src/data/connect-form-sprites.json","utf8"));
for(const [form,styles] of Object.entries(previousForms)){
 const target=forms[form]??={};
 for(const [style,dirs] of Object.entries(styles))if(!target[style])target[style]=dirs;
}
await writeFile("src/data/sprite-availability.json",JSON.stringify(available)+"\n");
await writeFile("src/data/connect-form-sprites.json",JSON.stringify(forms)+"\n");
const stage=path.resolve(".artifacts/sprite-catalog");await mkdir(stage,{recursive:true});
await writeFile(path.join(stage,"manifest.json.gz"),compressed);
await writeFile(path.join(stage,"README.txt"),"PokéAPI sprite manifest (https://pokeapi.github.io/sprites/manifest.json.gz)\nDownloaded for local offline sprite catalog; images are cached by the PokeStream application.\n");
console.log("[PokeStream] Indexed "+entries.length+" Pokémon graphics, "+Object.keys(forms).length+" named forms across "+sources.length+" sprite families.");

// Bundle Pikachu previews from every collection; full libraries remain in the existing user cache.
const previewFiles=new Set();
for(const source of sources){
 const prefix="pokemon/"+(source.path?source.path+"/":"");
 for(const file of entries){
  if(!file.startsWith(prefix)||!file.endsWith("/25."+source.extension))continue;
  const relative=file.slice(prefix.length),parts=relative.split("/");parts.pop();
  if(parts.some(part=>!validDir.has(part)))continue;
  previewFiles.add(file);
 }
}
const previewRoot=path.join(stage,"previews"),previews=[...previewFiles];let previewNext=0;
async function previewWorker(){
 while(previewNext<previews.length){
  const file=previews[previewNext++],target=path.join(previewRoot,...file.split("/"));
  try{if((await stat(target)).size>0)continue;}catch{}
  let failure;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetch("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/"+file,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error("Preview HTTP "+response.status+": "+file);
    const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length||buffer.length>20*1024*1024)throw Error("Invalid preview: "+file);
    await mkdir(path.dirname(target),{recursive:true});await writeFile(target,buffer);failure=null;break;
   }catch(error){failure=error;}
  }
  if(failure)throw failure;
 }
}
await Promise.all(Array.from({length:8},previewWorker));
console.log("[PokeStream] "+previewFiles.size+" Pikachu previews ready for offline use.");
