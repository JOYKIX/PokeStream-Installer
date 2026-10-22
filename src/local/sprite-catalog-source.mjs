// Shared by the release builder and the explicit in-app catalog refresh.
// Git trees supply actual byte sizes and blob digests without downloading the image repository.
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
const roman=["i","ii","iii","iv","v","vi","vii","viii","ix"];
export const validSpritePath=p=>typeof p==="string"&&p.length<360&&/^(pokemon|items|types|badges)\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.(png|gif|svg|webp)$/i.test(p)&&!p.split("/").some(s=>s==="."||s==="..");
async function request(url,signal){const cache=process.env.POKESTREAM_METADATA_CACHE&&/\/git\/trees\/[a-f0-9]{40}/.test(url)?path.join(process.env.POKESTREAM_METADATA_CACHE,createHash("sha256").update(url).digest("hex")+".json"):null;if(cache){try{return new Response(await fs.readFile(cache));}catch{}}let error;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url,{headers:{"user-agent":"PokeStream-Sprite-Catalog","accept":"application/vnd.github+json",...(process.env.POKESTREAM_CATALOG_TOKEN&&new URL(url).hostname==="api.github.com"?{authorization:"Bearer "+process.env.POKESTREAM_CATALOG_TOKEN}:{})},signal:AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(90000)]),cache:"no-store"});if(r.ok){if(cache){await fs.mkdir(path.dirname(cache),{recursive:true});await fs.writeFile(cache,Buffer.from(await r.clone().arrayBuffer()));}return r;}if(r.status===403||r.status===429)throw Error("sprite_catalog_rate_limit");throw Error("sprite_catalog_network (HTTP "+r.status+")");}catch(e){error=e;if(signal?.aborted||e.message==="sprite_catalog_rate_limit")throw e;if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}}throw error;}
/** @param {{signal?: AbortSignal, progress?: (prefix:string)=>void}} options */
export async function buildSpriteCatalog({signal,progress=(_prefix)=>{}}={}){
 const api="https://api.github.com/repos/PokeAPI/sprites";
 const commit=await (await request(api+"/commits/master",signal)).json();
 if(!/^[a-f0-9]{40}$/.test(commit.sha))throw Error("sprite_catalog_invalid");
 const root=await (await request(api+"/git/trees/"+commit.commit.tree.sha,signal)).json();
 const sprites=root.tree.find(e=>e.path==="sprites"&&e.type==="tree");if(!sprites)throw Error("sprite_catalog_invalid");
 const top=await (await request(api+"/git/trees/"+sprites.sha,signal)).json();
 const found=[];
 async function walk(sha,prefix){
  progress(prefix);let tree={truncated:true};if(prefix!=="pokemon/"&&prefix!=="pokemon/versions/"){try{tree=await (await request(api+"/git/trees/"+sha+"?recursive=1",signal)).json();}catch(e){if(!String(e.message).includes("HTTP 500"))throw e;}}
  if(tree.truncated){const direct=await (await request(api+"/git/trees/"+sha,signal)).json();for(const entry of direct.tree){if(entry.type==="tree")await walk(entry.sha,prefix+entry.path+"/");else collect(entry,prefix);}}
  else for(const entry of tree.tree)collect(entry,prefix);
 }
 function collect(entry,prefix){const file=prefix+entry.path;if(entry.type==="blob"&&validSpritePath(file)&&Number.isSafeInteger(entry.size)&&entry.size>0&&/^[a-f0-9]{40}$/.test(entry.sha))found.push({path:file,size:entry.size,sha:entry.sha});}
 for(const collection of ["pokemon","items","types","badges"]){const entry=top.tree.find(e=>e.path===collection&&e.type==="tree");if(entry)await walk(entry.sha,collection+"/");}
 if(found.length<15000||new Set(found.map(e=>e.path)).size!==found.length)throw Error("sprite_catalog_invalid");
 const csv=await (await request("https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv",signal)).text();
 const lines=csv.trim().split(/\r?\n/).map(line=>line.split(",")),columns=lines.shift(),idColumn=columns.indexOf("id"),speciesColumn=columns.indexOf("species_id"),nameColumn=columns.indexOf("identifier");
 if(idColumn<0||speciesColumn<0||nameColumn<0)throw Error("sprite_catalog_invalid");
 const species=new Map(lines.map(row=>[Number(row[idColumn]),{id:Number(row[speciesColumn]),name:row[nameColumn]}]));
 const speciesCSV=await (await request("https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv",signal)).text();
 const speciesRows=speciesCSV.trim().split(/\r?\n/).map(row=>row.split(",")),speciesColumns=speciesRows.shift(),slugColumn=speciesColumns.indexOf("identifier"),baseColumn=speciesColumns.indexOf("id");
 if(slugColumn<0||baseColumn<0)throw Error("sprite_catalog_invalid");
 const slugs=new Map(speciesRows.map(row=>[Number(row[baseColumn]),row[slugColumn]]));
 const packs=[...roman.map((_,i)=>({id:"gen-"+(i+1),label:(i+1)+"G",kind:"generation",generation:i+1})),
  ...[["artwork","Illustrations officielles"],["home","HOME"],["showdown","Showdown"],["dream-world","Dream World"],["default","Sprites par défaut"],["items","Objets"],["types","Types"],["badges","Badges"],["other","Autres ressources"]].map(([id,label])=>({id,label,kind:id==="items"||id==="types"||id==="badges"?"resources":"style"}))];
 const files=found.sort((a,b)=>a.path.localeCompare(b.path)).map(file=>{
  const generation=/\/(?:generation-)(i|ii|iii|iv|v|vi|vii|viii|ix)\//.exec(file.path)?.[1];
  const members=[];if(generation)members.push("gen-"+(roman.indexOf(generation)+1));
  if(file.path.startsWith("pokemon/other/official-artwork/"))members.push("artwork");
  else if(file.path.startsWith("pokemon/other/home/"))members.push("home");
  else if(file.path.startsWith("pokemon/other/showdown/"))members.push("showdown");
  else if(file.path.startsWith("pokemon/other/dream-world/"))members.push("dream-world");
  else if(/^pokemon\/(?:back\/|shiny\/|female\/)*[^/]+$/.test(file.path))members.push("default");
  if(file.path.startsWith("items/")){members.push("items",...roman.map((_,i)=>"gen-"+(i+1)));}
  if(file.path.startsWith("badges/")){members.push("badges",...roman.map((_,i)=>"gen-"+(i+1)));}
  if(file.path.startsWith("types/"))members.push("types");
  if(!members.length)members.push("other");
  const stem=file.path.split("/").pop().replace(/\.[^.]+$/,"");
  const number=/^(\d+)(?:-|$)/.exec(stem);let speciesId=0,form="",formName="";
  if(file.path.startsWith("pokemon/")&&number){const numeric=Number(number[1]),info=species.get(numeric);speciesId=info?.id??(numeric<=2000?numeric:0);formName=stem.includes("-")?(slugs.get(speciesId)??species.get(speciesId)?.name??String(speciesId))+"-"+stem.slice(stem.indexOf("-")+1):(info?.name??stem);form=formName;}
  return [file.path,file.size,file.sha,speciesId,form,formName,[...new Set(members)]];
 });
 const populated=packs.filter(pack=>files.some(file=>file[6].includes(pack.id))).map(pack=>{
  const entries=files.filter(file=>file[6].includes(pack.id)),hashes=new Map(entries.map(file=>[file[2],file[1]]));
  return {...pack,revision:createHash("sha256").update(entries.map(file=>file[0]+":"+file[2]).join("\n")).digest("hex"),bytes:[...hashes.values()].reduce((sum,n)=>sum+n,0),files:entries.length,compatible:[...new Set(entries.map(file=>file[3]).filter(Boolean))].length};
 });
 return {schema:2,commit:commit.sha,generatedAt:new Date().toISOString(),source:"https://github.com/PokeAPI/sprites",packs:populated,files};
}
