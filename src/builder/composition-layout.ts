import type {ElementType} from "./schema";
export const COMPOSITION_CONSOLES=["gb","gbc","gba","ds","3ds","switch"] as const;
export type CompositionOptions={console:typeof COMPOSITION_CONSOLES[number];screens:"side"|"stack";camera:boolean;chat:boolean;team:boolean;badges:boolean;counter:boolean};
export type Placement={type:ElementType;role:"main"|"secondary"|"camera"|"chat"|"team"|"badges"|"counter";x:number;y:number;width:number;height:number;platform?:"gb"|"gbc"|"gba"|"ds"|"3ds-top"|"3ds-bottom"|"switch";screen?:"top"|"bottom"};
const fit=(ratio:number,x:number,y:number,width:number,height:number)=>{const w=Math.min(width,height*ratio),h=w/ratio;return {x:Math.round(x+(width-w)/2),y:Math.round(y+(height-h)/2),width:Math.round(w),height:Math.round(h)};};
/** Reserved regions stay disjoint; fitting preserves every console's screen ratio. */
export function compositionLayout(options:CompositionOptions):Placement[]{
 const m=48,g=24,w=1920-2*m,dual=options.console==="ds"||options.console==="3ds",rows=(options.team?238:0)+(options.badges||options.counter?76:0)+(options.team&&(options.badges||options.counter)?g:0),height=1080-2*m-rows-(rows?g:0),rail=options.camera||options.chat||(dual&&options.screens==="side"),railWidth=rail?416:0,mainWidth=w-(rail?railWidth+g:0),parts:Placement[]=[];
 const ratio=options.console==="gb"||options.console==="gbc"?160/144:options.console==="gba"?1.5:options.console==="3ds"?400/240:options.console==="switch"?16/9:4/3;
 const mainPlatform=options.console==="3ds"?"3ds-top":options.console;
 if(dual&&options.screens==="stack"){
  const slot=(height-g)/2;parts.push({type:"game-screen",role:"main",platform:mainPlatform,screen:"top",...fit(ratio,m,m,mainWidth,slot)},{type:"game-screen",role:"secondary",platform:options.console==="3ds"?"3ds-bottom":"ds",screen:"bottom",...fit(4/3,m,m+slot+g,mainWidth,slot)});
 }else parts.push({type:"game-screen",role:"main",platform:mainPlatform,screen:"top",...fit(ratio,m,m,mainWidth,height)});
 const items:{type:ElementType;role:Placement["role"];ratio:number;weight:number;platform?:Placement["platform"];screen?:"bottom"}[]=[];
 if(dual&&options.screens==="side")items.push({type:"game-screen",role:"secondary",ratio:4/3,weight:1.2,platform:options.console==="3ds"?"3ds-bottom":"ds",screen:"bottom"});
 if(options.camera)items.push({type:"camera",role:"camera",ratio:16/9,weight:1});
 if(options.chat)items.push({type:"chat",role:"chat",ratio:0,weight:1.5});
 const total=items.reduce((n,p)=>n+p.weight,0),available=height-Math.max(0,items.length-1)*g;let y=m;
 for(const p of items){const h=available*p.weight/total,area=p.ratio?fit(p.ratio,m+mainWidth+g,y,railWidth,h):{x:m+mainWidth+g,y:Math.round(y),width:railWidth,height:Math.round(h)};parts.push({type:p.type,role:p.role,platform:p.platform,screen:p.screen,...area});y+=h+g;}
 y=m+height+g;if(options.team){parts.push({type:"team",role:"team",x:m,y,width:w,height:238});y+=238+g;}
 if(options.badges)parts.push({type:"badges",role:"badges",x:m,y,width:options.counter?w-224:w,height:76});
 if(options.counter)parts.push({type:"nuzlocke",role:"counter",x:1920-m-200,y,width:200,height:76});
 return parts;
}
