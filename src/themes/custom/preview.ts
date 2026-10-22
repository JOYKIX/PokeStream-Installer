import { demoScene } from "@/lib/demo";
import type { SceneData } from "@/lib/model";
import type { CustomThemeConfig } from "./schema";
import type { PreviewState } from "./editor-options";
export type PreviewProfile = {id:string;name:string;data:SceneData};
export function themePreview(
 config: CustomThemeConfig,
 layout: SceneData["style"]["teamLayout"] = "3x2",
 profile?: SceneData,
 state: PreviewState = "original",
): SceneData {
 const scene = profile ?? demoScene();
 const last = scene.team[0]!;
 const team = profile ? scene.team : [...scene.team.slice(0,5),{
   ...last,speciesId:1,pokemonId:1,name:"Œuf",apiName:"egg",nickname:"",isEgg:true,shiny:false,
 }].map((p,i)=>p ? {...p,nickname:"",hp:[120,48,15,0,100,0][i],maxHp:120,fainted:i===3,gender:(i%2?"female":"male") as "female"|"male",item:i<3?"oran-berry":""}:null);
 return {
  ...scene,name:"Theme Creator",badges:profile?scene.badges:[0,1,3],deaths:profile?scene.deaths:3,
  team:team.map((p,i)=>{
   if(!p||state==="original")return p;
   if(state==="egg"&&i===0)return {...p,speciesId:1,pokemonId:1,name:"Œuf",apiName:"egg",nickname:"",isEgg:true,shiny:false};
   if(p.isEgg)return p;
   if(state==="shiny")return {...p,shiny:true};
   if(state==="egg")return p;
   const maxHp=Math.max(1,p.maxHp??120);
   return {...p,maxHp,hp:state==="ko"?0:state==="low"?Math.max(1,Math.floor(maxHp*.12)):maxHp,fainted:state==="ko"};
  }),
  style:{...scene.style,theme:"custom",customTheme:config,customThemeId:undefined,customAccent:undefined,
   typeBadgeStyle:config.types.badgeStyle,
   accent:config.accent,sprite:config.sprite,spriteVariant:config.spriteVariant,teamLayout:layout,
   ...(!profile?{showHealth:true,showHealthValues:true,showGender:true,showItems:true,badgeBackground:true,badgeColumns:4}:{}),
  },
 };
}

