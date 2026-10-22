import "server-only";
import {promises as fs} from "node:fs";
import path from "node:path";
import {gunzipSync,gzipSync} from "node:zlib";
import {buildSpriteCatalog,validSpritePath} from "../sprite-catalog-source.mjs";
import {dataDirectory} from "../store";
export type SpriteFile=[path:string,bytes:number,hash:string,species:number,form:string,formName:string,packs:string[]];
export type SpritePack={id:string;label:string;kind:string;generation?:number;revision:string;bytes:number;files:number;compatible:number};
export type Catalog={schema:2;commit:string;generatedAt:string;source:string;packs:SpritePack[];files:SpriteFile[]};
export type Index=Catalog&{byPath:Map<string,SpriteFile>;byHash:Map<string,SpriteFile>;byPack:Map<string,SpriteFile[]>;bySpecies:Map<number,SpriteFile[]>};
const shared=globalThis as typeof globalThis&{pokeStreamSpriteCatalog?:Promise<Index>};
const dataFile=()=>path.join(dataDirectory(),"Sprites","catalog-v2.json.gz");
export function validCatalog(value:unknown):value is Catalog{
 if(!value||typeof value!=="object")return false;const c=value as Catalog;
 return c.schema===2&&/^[a-f0-9]{40}$/.test(c.commit)&&Array.isArray(c.packs)&&c.packs.length<100&&c.packs.every(p=>/^[a-z0-9-]+$/.test(p.id)&&typeof p.revision==="string")&&Array.isArray(c.files)&&c.files.length>=15000&&c.files.every(f=>Array.isArray(f)&&validSpritePath(f[0])&&Number.isSafeInteger(f[1])&&f[1]>0&&/^[a-f0-9]{40}$/.test(f[2])&&Number.isInteger(f[3])&&typeof f[4]==="string"&&typeof f[5]==="string"&&Array.isArray(f[6])&&f[6].every(p=>c.packs.some(pack=>pack.id===p)));
}
function index(c:Catalog):Index{const byPath=new Map<string,SpriteFile>(),byHash=new Map<string,SpriteFile>(),byPack=new Map<string,SpriteFile[]>(),bySpecies=new Map<number,SpriteFile[]>();for(const file of c.files){byPath.set(file[0],file);byHash.set(file[2],file);for(const pack of file[6]){if(!byPack.has(pack))byPack.set(pack,[]);byPack.get(pack)!.push(file);}if(file[3]){if(!bySpecies.has(file[3]))bySpecies.set(file[3],[]);bySpecies.get(file[3])!.push(file);}}return {...c,byPath,byHash,byPack,bySpecies};}
async function read(file:string){const raw=await fs.readFile(file);if(raw.length>32*1024*1024)throw Error("sprite_catalog_invalid");const c:unknown=JSON.parse(gunzipSync(raw,{maxOutputLength:100*1024*1024}).toString());if(!validCatalog(c))throw Error("sprite_catalog_invalid");return c;}
async function load(){const candidates=await Promise.all([dataFile(),path.join(process.cwd(),"public/sprites/catalog-v2.json.gz"),path.join(process.cwd(),".artifacts/sprite-catalog/catalog-v2.json.gz")].map(p=>read(p).catch(()=>null)));const catalog=candidates.filter((c):c is Catalog=>!!c).sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt))[0];if(!catalog)throw Error("sprite_catalog_missing");return index(catalog);}
export const spriteCatalog=()=>shared.pokeStreamSpriteCatalog??=load().catch(e=>{delete shared.pokeStreamSpriteCatalog;throw e;});
export async function refreshSpriteCatalog(signal:AbortSignal,progress:(message:string)=>void){const c=await buildSpriteCatalog({signal,progress}) as Catalog;if(!validCatalog(c))throw Error("sprite_catalog_invalid");const file=dataFile(),temp=file+".tmp";await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(temp,gzipSync(JSON.stringify(c),{level:6}));await fs.rename(temp,file);shared.pokeStreamSpriteCatalog=Promise.resolve(index(c));return shared.pokeStreamSpriteCatalog;}
