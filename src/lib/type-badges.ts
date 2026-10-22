import catalog from "@/data/type-badges.json";
export type TypeBadgeDefinition = {id:string;label:string;variant:string;generation:number;path:string;language:"fr"|"en";types:number[];games?:string[];assets?:Record<string,string>;dimensions?:Record<string,number[]>};
export const TYPE_BADGE_STYLES = catalog.styles as TypeBadgeDefinition[];
export const TYPE_BADGE_IDS = ["text", ...TYPE_BADGE_STYLES.map(style=>style.id)] as [string, ...string[]];
export const TYPE_BADGE_NUMBERS: Record<string,number> = {normal:1,fighting:2,flying:3,poison:4,ground:5,rock:6,bug:7,ghost:8,steel:9,fire:10,water:11,grass:12,electric:13,psychic:14,ice:15,dragon:16,dark:17,fairy:18};
export function typeBadgeSource(type:string,style:string) {
  const definition=TYPE_BADGE_STYLES.find(item=>item.id===style),number=TYPE_BADGE_NUMBERS[type];
  if(!definition?.types.includes(number))return null;
  const url=definition.assets?.[type]??(definition.language==="en"?"/api/sprites/types/"+definition.path+"/"+number+".png":null);
  return url?{url,compact:definition.variant.includes("small"),pixelated:definition.generation<=5}:null;
}
