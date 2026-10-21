"use client";
import {useState} from "react";
import dynamic from "next/dynamic";
import {ChevronDown} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {Select,SelectOption} from "./select";
import {PokemonImage} from "./pokemon-image";
import {spriteSource,VARIANT_LABELS,type SpriteStyle,type SpriteVariant} from "@/lib/sprite-options";
import {availableVariants} from "@/lib/sprites";
import type {SceneData} from "@/lib/model";
import type {SpriteInheritance} from "./sprite-picker";
import "@/styles/sprite-picker.css";
const SpritePicker=dynamic(()=>import("./sprite-picker"));
const pikachu={pokemonId:25,name:"Pikachu",shiny:false};
export function SpriteSelector({style,onChange,inherit}:{
 style:Pick<SceneData["style"],"sprite"|"spriteVariant">;
 onChange:(patch:Partial<SceneData["style"]>)=>void;inherit?:SpriteInheritance;
}){
 const {t}=useI18n();const [open,setOpen]=useState(false);
 const source=spriteSource(style.sprite),variants=availableVariants(style.sprite);
 function choose(value:SpriteStyle|"inherit"){
  if(value==="inherit"){inherit?.onSelect();return;}
  const allowed=availableVariants(value);
  onChange({sprite:value,spriteVariant:allowed.includes(style.spriteVariant??"default")?style.spriteVariant:"default"});
 }
 return <>
  <label className="field">{t("Illustrations")}
   <button type="button" className="sprite-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
    <span className="sprite-trigger-preview"><PokemonImage pokemon={pikachu} style={style.sprite} variant={style.spriteVariant} size={44}/></span>
    <span className="sprite-trigger-label"><strong>{t(inherit?.active?inherit.label:source.label)}</strong><small>{t(source.group)}</small></span><ChevronDown size={16} aria-hidden="true"/>
   </button>
  </label>
  {!inherit?.active&&variants.length>1&&<label className="field">{t("Vue")}<Select aria-label={t("Vue")} value={variants.includes(style.spriteVariant??"default")?style.spriteVariant??"default":"default"} onValueChange={value=>onChange({spriteVariant:value as SpriteVariant})}>{variants.map(value=><SelectOption value={value} key={value}>{t(VARIANT_LABELS[value])}</SelectOption>)}</Select></label>}
  <p className="sprite-note">{t("Variantes selon le Pokémon. Remplacement si indisponible.")}</p>
  {open&&<SpritePicker open={open} onClose={()=>setOpen(false)} onSelect={choose} selected={style.sprite} variant={style.spriteVariant} inherit={inherit}/>}
 </>;
}
