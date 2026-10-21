import "server-only";
import { readFile,writeFile,mkdir,unlink } from "node:fs/promises";
import path from "node:path";
import { dataDirectory,readStore,transact,type Asset } from "./store";
export const assetFile=(id:string)=>{if(!/^[0-9a-f-]{36}$/.test(id))throw Error("Invalid asset");return path.join(dataDirectory(),"images",id+".png");};
export async function saveAsset(id:string,bytes:Uint8Array){await mkdir(path.dirname(assetFile(id)),{recursive:true});await writeFile(assetFile(id),bytes,{flag:"wx"});}
export async function assetBytes(id:string){return readFile(assetFile(id));}
export async function removeAssetFiles(ids:string[]){for(const id of ids)await unlink(assetFile(id)).catch(e=>{if(e.code!=="ENOENT")throw e;});}
export async function cleanupAssets(owner:string,discard:string[]=[]){
 const removed=transact(s=>{const used=new Set(s.tables.builder_overlays.flatMap(b=>b.data.elements.flatMap(e=>e.type==="image"&&e.properties.assetId?[e.properties.assetId]:[])));
 const gone=s.tables.builder_assets.filter(a=>a.owner_id===owner&&!used.has(a.id)&&(discard.includes(a.id)||!a.ready&&Date.parse(a.upload_expires_at)<Date.now()));
 s.tables.builder_assets=s.tables.builder_assets.filter(a=>!gone.some(g=>g.id===a.id));return gone.map(a=>a.id);});
 await removeAssetFiles(removed);
 return readStore().tables.builder_assets.filter(a=>a.owner_id===owner&&a.ready).map(({id,name,width,height})=>({id,name,width,height}));
}
