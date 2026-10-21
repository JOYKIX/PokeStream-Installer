// Offline form catalog — no PokéAPI request is necessary to edit a Pokémon.
import catalog from "@/data/pokedex.json";
import gameData from "@/data/connect-game-data.json";
import {TYPES} from "@/lib/model";

const typeSet = new Set<string>(TYPES);
export async function GET(_r:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^\d{1,4}$/.test(id)||Number(id)<1||Number(id)>1025)return Response.json({error:"Pokémon inconnu."},{status:400});
 const species=Number(id),base=catalog.find(p=>p.id===species);
 if(!base)return Response.json({error:"Pokémon inconnu."},{status:404});
 const entries=new Map<number,{id:number;name:string;label:string;labelEn:string;types:string[]}>();
 entries.set(species,{id:species,name:base.slug,label:"Classique",labelEn:"Classic",types:base.types});
 for(const [key,form] of Object.entries(gameData.forms)){
  const segments=key.split(":");if(Number(segments[1])!==species)continue;
  if(!form||!Number.isInteger(form.pokemonId)||form.pokemonId<1||form.pokemonId>20000||typeof form.apiName!=="string")continue;
  if(entries.has(form.pokemonId))continue;
  const suffix=form.apiName.startsWith(base.slug+"-")?form.apiName.slice(base.slug.length+1):form.apiName;
  const label=suffix.replaceAll("-"," ").replace(/^./,c=>c.toUpperCase());
  const types=Array.isArray(form.types)?form.types.filter(t=>typeSet.has(t)).slice(0,2):base.types;
  entries.set(form.pokemonId,{id:form.pokemonId,name:form.apiName,label,labelEn:label,types:types.length?types:base.types});
 }
 return Response.json({forms:[...entries.values()].slice(0,30)},{headers:{"Cache-Control":"public, max-age=86400"}});
}
