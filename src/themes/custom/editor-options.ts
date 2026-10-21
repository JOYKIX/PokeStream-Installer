import { Boxes, CreditCard, Image, Type, Tags, VenusAndMars, Package, HeartPulse, Shield, Skull } from "lucide-react";
import { z } from "zod";
import { themeInputSchema, type CustomThemeConfig } from "./schema";
export const sections = [
 ["general","Général",Boxes],["card","Cartes",CreditCard],["sprite","Sprite",Image],["text","Nom et niveau",Type],
 ["types","Types",Tags],["gender","Sexe",VenusAndMars],["item","Objet tenu",Package],["health","Barre de vie",HeartPulse],
 ["badges","Badges",Shield],["counter","Compteur Nuzlocke",Skull],
] as const;
export type Section = typeof sections[number][0];
export const sectionKeys: Record<Section,(keyof CustomThemeConfig)[]> = {
 general:["accent","font","align","shadow","spacing"],card:["card","cardAccent","accentWidth","cardWidth","cardPadding","contentGap"],
 sprite:["sprite","spriteVariant","spritePanel","spritePanelVisible","spriteEffect","spriteRotation"],text:["name","level"],
 types:["types"],gender:["gender"],item:["item"],health:["health"],badges:["badges","badgeGap","badgePadding"],
 counter:["counter","counterText","counterIcon","counterLayout","counterIconVisible"],
};
export const sectionSizes: Partial<Record<Section,(keyof CustomThemeConfig["sizes"])[]>> = {
 sprite:["sprite"],gender:["gender"],item:["item","itemSprite"],badges:["badges"],counter:["counter"],
};
export const surfaceKeys = {card:"card",sprite:"spritePanel",item:"item",badges:"badges",counter:"counter"} as const;
export const palettes = [
 {name:"Rubis",accent:"#ef3340",base:"#18141a",panel:"#261a23",border:"#50343e",text:"#fff0f2",muted:"#bfa6ae"},
 {name:"Océan",accent:"#48b8ec",base:"#0d1e2c",panel:"#183449",border:"#34566b",text:"#e1f5ff",muted:"#96b7c9"},
 {name:"Forêt",accent:"#8acb83",base:"#14221b",panel:"#253b2c",border:"#446a4f",text:"#e5f4df",muted:"#9eb49b"},
 {name:"Améthyste",accent:"#ba92f5",base:"#20172e",panel:"#352244",border:"#644776",text:"#f3eaff",muted:"#b8a3c9"},
 {name:"Papier",accent:"#ba563d",base:"#f2ebdf",panel:"#e2d7c4",border:"#c3b197",text:"#302e29",muted:"#736453"},
 {name:"Monochrome",accent:"#eeeeee",base:"#151515",panel:"#252525",border:"#484848",text:"#ffffff",muted:"#a7a7a7"},
] as const;
export function applyPalette(config:CustomThemeConfig,index:number):CustomThemeConfig {
 const p=palettes[index],c=structuredClone(config);
 c.accent=p.accent;
 for(const key of ["card","spritePanel","item","badges","counter"] as const) {
  c[key]={...c[key],color:key==="spritePanel"?p.panel:p.base,colorEnd:p.panel,border:p.border};
 }
 c.name.color=p.text;c.level.color=p.muted;c.counterText=p.text;c.counterIcon=p.accent;
 c.health={...c.health,track:p.panel,text:p.muted,border:p.border};
 return c;
}
export const themeFileSchema=z.object({format:z.literal("pokestream-theme"),version:z.literal(1),theme:themeInputSchema}).strict();
export const previewStates = [["original","État du profil"],["healthy","PV pleins"],["low","PV faibles"],["ko","K.O."],["shiny","Chromatique"],["egg","Œuf"]] as const;
export type PreviewState=typeof previewStates[number][0];
