import "server-only";
import {promises as fs} from "node:fs";
import path from "node:path";
import {spriteCatalog,refreshSpriteCatalog,type SpriteFile,type Index} from "./catalog";
import {SpriteStorage,spriteRoot,objectPath,partPath,bundledPath,legacyPath,blobHash,imageValid} from "./storage";
import dex from "@/data/pokedex.json";
import sources from "@/data/sprite-sources.json";
const referenceIds=new Set(dex.map(p=>p.id));
const unique=(files:SpriteFile[])=>[...new Map(files.map(f=>[f[2],f])).values()];
class SpriteService{
 storage=new SpriteStorage();catalog:Index|null=null;initializing:Promise<void>|null=null;scanning:Promise<void>|null=null;running:Promise<void>|null=null;controller:AbortController|null=null;pending=new Map<string,Promise<Buffer|null>>();epoch=0;maintenance=false;message="";catalogProgress="";
 async init(){if(!this.initializing)this.initializing=spriteCatalog().then(c=>{this.catalog=c;return this.loadBundledIndex();});await this.initializing;return this;}
 async loadBundledIndex(){try{const entries=JSON.parse(await fs.readFile(path.join(process.cwd(),"public/sprites/bundled-index.json"),"utf8"));for(const [hash,key] of Object.entries(entries)){const entry=this.catalog!.byPath.get(String(key));if(entry&&entry[2]===hash)this.storage.bundled.set(hash,bundledPath(entry));}}catch{}}
 startScan(){if(this.scanning)return this.scanning;const c=this.catalog!;this.scanning=this.storage.scanFiles(c).catch(e=>{this.message=String(e.message);}).finally(()=>{this.scanning=null;});return this.scanning;}
 async ready(){await this.init();if(this.storage.scan.state==="idle")void this.startScan();return this;}
 async disk(){try{const s=await fs.statfs(spriteRoot());return Number(s.bavail)*Number(s.bsize);}catch{return null;}}
 mode(): "online"|"offline"{return this.storage.db.prepare("SELECT value FROM metadata WHERE key='sprite-mode'").get()?.value==="offline"?"offline":"online";}
 renderEpoch=Date.now().toString(36);
 renderState(){return {mode:this.mode(),revision:this.renderEpoch+":"+this.storage.revision};}
 async setMode(value:unknown){if(value!=="online"&&value!=="offline")throw Error("sprite_mode_invalid");this.storage.db.prepare("INSERT OR REPLACE INTO metadata VALUES('sprite-mode',?)").run(value);this.storage.revision++;return this.snapshot();}
 onlinePending=new Map<string,Promise<Buffer>>();onlineCache=new Map<string,Buffer>();onlineBytes=0;onlineActive=0;onlineQueue:(()=>void)[]=[];
 async resolveFile(file:SpriteFile,localOnly=false){
  const local=await this.getFile(file,true);if(local||localOnly||this.mode()==="offline")return local;
  const cached=this.onlineCache.get(file[2]);if(cached){this.onlineCache.delete(file[2]);this.onlineCache.set(file[2],cached);return cached;}
  const pending=this.onlinePending.get(file[2]);if(pending)return pending;
  const task=(async()=>{
   if(this.onlineActive>=6)await new Promise<void>(resolve=>this.onlineQueue.push(resolve));else this.onlineActive++;
   try{
    const response=await fetch("https://raw.githubusercontent.com/PokeAPI/sprites/"+this.catalog!.commit+"/sprites/"+file[0],{signal:AbortSignal.timeout(20000),cache:"no-store"});
    if(!response.ok)throw Error("sprite_network_error");
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of response.body!){size+=chunk.length;if(size>file[1]){await response.body?.cancel().catch(()=>{});throw Error("sprite_integrity_error");}chunks.push(Buffer.from(chunk));}
    const data=Buffer.concat(chunks);
    if(data.length!==file[1]||blobHash(data)!==file[2]||!imageValid(data,file[0]))throw Error("sprite_integrity_error");
    // A bounded RAM cache avoids writing online sprites into the persistent library.
    while(this.onlineCache.size&&(this.onlineBytes+data.length>64*1024*1024||this.onlineCache.size>=128)){const key=this.onlineCache.keys().next().value!;this.onlineBytes-=this.onlineCache.get(key)!.length;this.onlineCache.delete(key);}
    this.onlineCache.set(file[2],data);this.onlineBytes+=data.length;return data;
   }finally{const next=this.onlineQueue.shift();if(next)next();else this.onlineActive--;}
  })().finally(()=>this.onlinePending.delete(file[2]));
  this.onlinePending.set(file[2],task);return task;
 }
 async getFile(file:SpriteFile,localOnly=false,signal?:AbortSignal){
  const epoch=this.epoch;if(this.storage.objects.get(file[2])===file[1])try{const data=await fs.readFile(objectPath(file[2]));if(data.length===file[1]&&blobHash(data)===file[2])return data;this.storage.objects.delete(file[2]);}catch{this.storage.objects.delete(file[2]);}
  for(const candidate of [legacyPath(file[0]),this.storage.bundled.get(file[2])??bundledPath(file)])try{const data=await fs.readFile(candidate);if(data.length===file[1]&&blobHash(data)===file[2]&&imageValid(data,file[0]))return data;}catch{}
  if(localOnly||this.maintenance||signal?.aborted)return null;
  const previous=this.pending.get(file[2]);if(previous)return previous;
  const task=this.fetch(file,signal,epoch).finally(()=>this.pending.delete(file[2]));this.pending.set(file[2],task);return task;
 }
 async fetch(file:SpriteFile,signal:AbortSignal|undefined,epoch:number){
  const final=objectPath(file[2]),temp=partPath(file[2]);await this.storage.guard(final);await fs.mkdir(path.dirname(final),{recursive:true});
  for(let attempt=0;attempt<3;attempt++){
   if(epoch!==this.epoch||this.maintenance||signal?.aborted)throw Error("sprite_cancelled");
   try{let offset=await fs.stat(temp).then(s=>s.size).catch(()=>0);if(offset>file[1]){await this.storage.unlink(temp);offset=0;}
    if(offset<file[1]){const response=await fetch("https://raw.githubusercontent.com/PokeAPI/sprites/"+this.catalog!.commit+"/sprites/"+file[0],{signal:AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(45000)]),headers:offset?{Range:"bytes="+offset+"-"}:{},cache:"no-store"});if(response.status===404)throw Error("sprite_source_unavailable");if(!response.ok)throw Error("sprite_network_error");if(response.status!==206){offset=0;await this.storage.unlink(temp);}else if(!String(response.headers.get("content-range")).startsWith("bytes "+offset+"-"))throw Error("sprite_integrity_error");
     let received=offset;const handle=await fs.open(temp,offset?"a":"w");try{for await(const chunk of response.body!){if(epoch!==this.epoch||this.maintenance||signal?.aborted)throw Error("sprite_cancelled");received+=chunk.length;if(received>file[1])throw Error("sprite_integrity_error");await handle.write(chunk);}}finally{await handle.close();this.storage.parts.set(file[2],await fs.stat(temp).then(s=>s.size).catch(()=>0));}
    }
    const data=await fs.readFile(temp);if(data.length!==file[1]||blobHash(data)!==file[2]||!imageValid(data,file[0])){await this.storage.unlink(temp);throw Error("sprite_integrity_error");}
    if(epoch!==this.epoch||this.maintenance||signal?.aborted)throw Error("sprite_cancelled");await fs.rename(temp,final);this.storage.parts.delete(file[2]);this.storage.object(file[2],data.length);
    if(!this.storage.db.prepare("SELECT 1 FROM ownership WHERE hash=? LIMIT 1").get(file[2])){const owner=file[6].find(p=>!p.startsWith("gen-"))??file[6][0];this.storage.claim(owner,file[2],this.catalog!.packs.find(p=>p.id===owner)!.revision);}
    return data;
   }catch(error){if(signal?.aborted||epoch!==this.epoch||this.maintenance)throw Error("sprite_cancelled");if((error as NodeJS.ErrnoException).code==="ENOSPC")throw Error("sprite_disk_full");if(attempt===2)throw error;await new Promise(r=>setTimeout(r,400*(attempt+1)));}
  }return null;
 }
 async snapshot(){await this.ready();const c=this.catalog!,s=this.storage;const owners=new Map<string,Set<string>>();for(const row of s.db.prepare("SELECT pack,hash FROM ownership").all()){const hash=String(row.hash);if(!owners.has(hash))owners.set(hash,new Set());owners.get(hash)!.add(String(row.pack));}
  const loose=s.loose();
  const packs=c.packs.map(pack=>{const files=c.byPack.get(pack.id)??[],blobs=unique(files),owned=new Set(s.ownedHashes(pack.id));let occupied=0,reclaimable=0;for(const hash of new Set([...blobs.map(f=>f[2]),...owned])){const bytes=s.objects.get(hash)??0;occupied+=bytes;if(bytes&&![...(owners.get(hash)??[])].some(owner=>owner!==pack.id))reclaimable+=bytes;}
   let partialBytes=0;for(const f of blobs){const bytes=s.parts.get(f[2])??0;partialBytes+=bytes;if(bytes&&!s.ownsElsewhere(f[2],pack.id))reclaimable+=bytes;}
   let looseSize=0;for(const item of loose){const f=c.byPath.get(item.path)??c.byHash.get(/^\.objects\/[a-f0-9]{2}\/([a-f0-9]{40})$/.exec(item.path)?.[1]??"");if(f?.[6].includes(pack.id)){looseSize+=item.bytes;if(!s.ownsElsewhere(f[2],pack.id))reclaimable+=item.bytes;}}
   const local=files.filter(f=>s.present(f)),missing=blobs.filter(f=>!s.present(f)),selection=s.selections.get(pack.id),job=s.jobs.get(pack.id);let state="absent";
   if(job&&["downloading","queued"].includes(job.state))state=job.state;else if(local.length===files.length)state="installed";else if(selection&&selection.revision!==pack.revision&&selection.origin!=="cache")state="update";else if(local.length||selection)state="partial";
   if(selection&&selection.revision!==pack.revision&&selection.origin!=="cache"&&state==="installed")state="update";
   return {...pack,state,localFiles:local.length,localSpecies:new Set(local.map(f=>f[3]).filter(Boolean)).size,speciesTotal:dex.length,incompatible:dex.length-new Set(files.map(f=>f[3]).filter(id=>referenceIds.has(id))).size,downloadBytes:missing.reduce((n,f)=>n+f[1],0),occupiedBytes:occupied+partialBytes+looseSize,partialBytes,reclaimableBytes:reclaimable,job:job??null};});
  const blobs=unique(c.files),downloadBytes=blobs.filter(f=>!s.present(f)).reduce((n,f)=>n+f[1],0),occupiedBytes=[...s.objects.values()].reduce((n,b)=>n+b,0),looseBytes=s.loose().reduce((n,f)=>n+f.bytes,0);
  return {...this.renderState(),schema:2,commit:c.commit,updatedAt:c.generatedAt,packs,totalBytes:blobs.reduce((n,f)=>n+f[1],0),downloadBytes,occupiedBytes,looseBytes,partialBytes:[...s.parts.values()].reduce((n,b)=>n+b,0),freeBytes:await this.disk(),scan:{...s.scan},maintenance:this.maintenance,catalogProgress:this.catalogProgress,message:this.message,jobs:[...s.jobs.values()].filter(j=>["queued","downloading","paused","error"].includes(j.state))};
 }
 async command(action:string,pack="all",confirm=false){await this.ready();const c=this.catalog!;if(pack!=="all"&&!c.byPack.has(pack))throw Error("sprite_pack_missing");
  if(action==="pause"||action==="cancel"){for(const job of this.storage.jobs.values())if((pack==="all"||job.pack===pack)&&["queued","downloading","paused","error"].includes(job.state)){this.storage.setJob({...job,state:action==="cancel"?"cancelled":"paused",updated:Date.now()});if(this.controller&&job.pack===this.activePack)this.controller.abort();}if(pack==="all"&&this.running)await this.running;return this.snapshot();}
  if(this.maintenance||this.storage.scan.state==="scanning")throw Error("sprite_busy");
  if(action==="remove"){if(!confirm)throw Error("sprite_confirmation_required");this.maintenance=true;this.epoch++;this.controller?.abort();try{await this.running;await Promise.allSettled(this.pending.values());const ids=pack==="all"?[...this.storage.selections.keys()]:[pack],candidates=new Set<string>();for(const id of ids){for(const hash of this.storage.ownedHashes(id))candidates.add(hash);for(const f of c.byPack.get(id)??[])candidates.add(f[2]);this.storage.removeSelection(id);}if(pack==="all")for(const hash of this.storage.objects.keys())candidates.add(hash);for(const hash of candidates)if((this.storage.objects.has(hash)||this.storage.parts.has(hash))&&!this.storage.db.prepare("SELECT 1 FROM ownership WHERE hash=? LIMIT 1").get(hash))await this.storage.removeObject(hash);
    for(const item of this.storage.loose()){const file=c.byPath.get(item.path)??c.byHash.get(/^\.objects\/[a-f0-9]{2}\/([a-f0-9]{40})$/.exec(item.path)?.[1]??"");if(pack==="all"||file?.[6].includes(pack)){if(pack!=="all"&&file&&this.storage.ownsElsewhere(file[2],pack))continue;await this.storage.unlink(legacyPath(item.path));this.storage.db.prepare("DELETE FROM loose WHERE path=?").run(item.path);}}
    const parts=async(dir:string)=>{try{for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const file=path.join(dir,e.name);if(e.isDirectory())await parts(file);else if(/^[a-f0-9]{40}\.part$/.test(e.name)){const hash=e.name.slice(0,40);if(pack==="all"||candidates.has(hash)&&!this.storage.db.prepare("SELECT 1 FROM ownership WHERE hash=? LIMIT 1").get(hash)){await this.storage.unlink(file);this.storage.parts.delete(hash);}}}}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}};await parts(path.join(spriteRoot(),".objects"));
   }finally{this.maintenance=false;void this.run();}return this.snapshot();}
  if(action==="refresh"){this.maintenance=true;this.epoch++;this.controller?.abort();try{await this.running;await Promise.allSettled(this.pending.values());this.catalog=await refreshSpriteCatalog(new AbortController().signal,p=>{this.catalogProgress=p;});this.initializing=Promise.resolve();this.catalogProgress="";this.storage.scan.state="idle";await this.startScan();}finally{this.catalogProgress="";this.maintenance=false;}return this.snapshot();}
  if(action==="verify"){this.maintenance=true;this.epoch++;this.controller?.abort();try{await this.running;await Promise.allSettled(this.pending.values());await this.startScan();}finally{this.maintenance=false;}return this.snapshot();}
  if(!["start","resume","repair"].includes(action))throw Error("sprite_action_invalid");
  const requested=pack==="all"?c.packs:[c.packs.find(p=>p.id===pack)!],files=unique(requested.flatMap(p=>c.byPack.get(p.id)??[])),needed=files.filter(f=>!this.storage.present(f)).reduce((n,f)=>n+f[1],0),free=await this.disk();if(free!==null&&needed>free)throw Error("sprite_disk_full");
  if(action==="repair"){if(this.running)throw Error("sprite_busy");this.maintenance=true;this.epoch++;try{await Promise.allSettled(this.pending.values());await this.startScan();}finally{this.maintenance=false;}}
  for(const p of requested){if(this.storage.jobs.get(p.id)?.state==="downloading")continue;const entries=unique(c.byPack.get(p.id)??[]);this.storage.select(p.id,p.revision,entries.map(f=>f[2]));this.storage.setJob({pack:p.id,state:"queued",error:"",done:0,total:entries.length,bytes:0,updated:Date.now()});}void this.run();return this.snapshot();
 }
 activePack="";
 run(){if(this.running||this.maintenance)return this.running;this.running=(async()=>{while(!this.maintenance){const job=[...this.storage.jobs.values()].find(j=>j.state==="queued");if(!job)break;this.activePack=job.pack;this.controller=new AbortController();const signal=this.controller.signal,files=unique(this.catalog!.byPack.get(job.pack)??[]);let next=0,failed=0,last=0;Object.assign(job,{state:"downloading",done:0,total:files.length,error:""});this.storage.setJob(job);
   const save=()=>{if(Date.now()-last>600){last=Date.now();const current=this.storage.jobs.get(job.pack);if(current?.state==="downloading")this.storage.setJob({...job,updated:Date.now()});}};
   const worker=async()=>{while(!signal.aborted&&next<files.length){const file=files[next++];try{if(!this.storage.present(file)){const data=await this.getFile(file,false,signal);if(!data)throw Error("sprite_source_unavailable");job.bytes+=data.length;}job.done++;}catch(e){if(!signal.aborted){failed++;job.error=(e as Error).message;if(job.error==="sprite_disk_full")this.controller?.abort();}}save();}};
   await Promise.all(Array.from({length:6},worker));const current=this.storage.jobs.get(job.pack);if(current){const complete=files.every(f=>this.storage.present(f));if(complete){for(const hash of this.storage.objects.keys())if(!this.storage.db.prepare("SELECT 1 FROM ownership WHERE hash=? LIMIT 1").get(hash))await this.storage.removeObject(hash);}this.storage.setJob({...job,state:complete?"done":current.state!=="downloading"?current.state:failed||job.error?"error":"paused",updated:Date.now()});}
  }} )().catch(e=>{this.message=(e as Error).message;}).finally(()=>{this.running=null;this.controller=null;this.activePack="";});return this.running;
 }
 async species(pack:string){await this.ready();if(pack!=="all"&&!this.catalog!.byPack.has(pack))throw Error("sprite_pack_missing");const entries=pack==="all"?this.catalog!.files:this.catalog!.byPack.get(pack)!,map=new Map<number,SpriteFile[]>();for(const f of entries)if(f[3]){if(!map.has(f[3]))map.set(f[3],[]);map.get(f[3])!.push(f);}return dex.map(p=>{const files=map.get(p.id)??[],local=files.filter(f=>this.storage.present(f)),thumbnail=local.find(f=>!f[0].includes("/back/")&&!f[0].includes("/shiny/"))??local[0];return {id:p.id,compatible:files.length>0,total:files.length,local:local.length,forms:new Set(files.map(f=>f[5])).size,variants:files.length>1,thumbnail:thumbnail?"/api/sprites/"+thumbnail[0]+"?local=1":null};});}
 async variants(pack:string,id:number){await this.ready();const files=(id===0?this.catalog!.byPack.get(pack)??[]:this.catalog!.bySpecies.get(id)??[]).filter(f=>pack==="all"||f[6].includes(pack));return files.map(f=>{const source=[...sources].sort((a,b)=>b.path.length-a.path.length).find(s=>f[0].startsWith("pokemon/"+(s.path?s.path+"/":""))&&f[0].endsWith("."+s.extension));const flags={shiny:f[0].includes("/shiny/"),back:f[0].includes("/back/"),female:f[0].includes("/female/"),animated:/\/animated\/|\.gif$/.test(f[0]),icon:/\/icons\//.test(f[0])};return {path:f[0],form:f[4],formName:f[5],source:source?.label??f[0].split("/").slice(0,-1).join(" / "),bytes:f[1],installed:this.storage.present(f),included:this.storage.bundled.has(f[2]),...flags,url:this.storage.present(f)?"/api/sprites/"+f[0]+"?local=1":null};});}
}
const globalService=globalThis as typeof globalThis&{pokeStreamSpriteService?:SpriteService};
export const spriteService=()=>globalService.pokeStreamSpriteService??=new SpriteService();

export type LibrarySnapshot=Awaited<ReturnType<SpriteService["snapshot"]>>;
export type SpeciesRow=Awaited<ReturnType<SpriteService["species"]>>[number];
export type VariantRow=Awaited<ReturnType<SpriteService["variants"]>>[number];
