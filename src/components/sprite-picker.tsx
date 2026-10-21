"use client";
import {useState} from "react";
import {Check,ImageOff,RotateCcw,Search,Sparkles} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {normalizeSearch} from "@/lib/model";
import {SPRITE_SOURCES,SPRITE_GROUPS,type SpriteStyle,type SpriteVariant} from "@/lib/sprite-options";
import {availableVariants,spriteCandidates} from "@/lib/sprites";
import {PokemonImage} from "./pokemon-image";
import {Select,SelectOption} from "./select";
import {Modal} from "./ui";

export type SpriteInheritance={active:boolean;label:string;onSelect:()=>void};
export default function SpritePicker({open,onClose,onSelect,selected,variant="default",inherit}:{
 open:boolean;onClose:()=>void;onSelect:(value:SpriteStyle|"inherit")=>void;
 selected:SpriteStyle;variant?:SpriteVariant;inherit?:SpriteInheritance;
}){
 const {t}=useI18n();
 const [query,setQuery]=useState(""),[group,setGroup]=useState("all"),[shiny,setShiny]=useState(false);
 const search=normalizeSearch(query);
 const sources=SPRITE_SOURCES.filter(source=>(group==="all"||source.group===group)&&normalizeSearch([source.label,t(source.label),source.group,t(source.group),source.id].join(" ")).includes(search));
 function choose(value:SpriteStyle|"inherit"){onSelect(value);onClose();}
 return <Modal open={open} onOpenChange={value=>!value&&onClose()} title={t("Choisir un style de sprite")} wide>
  <div className="sprite-picker">
   <div className="picker-filters sprite-picker-filters">
    <div className="search-field"><Search size={18} aria-hidden="true"/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("Rechercher un style…")} aria-label={t("Rechercher un style de sprite")}/></div>
    <Select value={group} aria-label={t("Filtrer par génération")} onValueChange={setGroup}>
     <SelectOption value="all">{t("Toutes les générations")}</SelectOption>
     {SPRITE_GROUPS.map(value=><SelectOption value={value} key={value}>{t(value)}</SelectOption>)}
    </Select>
   </div>
   <div className="sprite-picker-toolbar"><span>{t("Aperçu avec Pikachu")}</span><button type="button" className="sprite-shiny-toggle" aria-pressed={shiny} onClick={()=>setShiny(value=>!value)}><Sparkles size={15} aria-hidden="true"/>{t("Shiny")}</button></div>
   {inherit&&<button type="button" className="sprite-inherit-option" aria-pressed={inherit.active} onClick={()=>choose("inherit")}><RotateCcw size={17} aria-hidden="true"/><span>{t(inherit.label)}</span>{inherit.active&&<Check size={17} aria-hidden="true"/>}</button>}
   <div className="sprite-picker-scroll">
    {sources.length?<div className="sprite-picker-grid">{sources.map(source=>{
     const active=!inherit?.active&&source.id===selected;
     const previewVariant=availableVariants(source.id).includes(variant)?variant:"default";
     const hasPikachu=spriteCandidates({pokemonId:25,shiny},source.id,previewVariant,false).length>0;
     return <button type="button" key={source.id} className={"sprite-style-card"+(active?" selected":"")} aria-pressed={active} onClick={()=>choose(source.id)}>
      <span className="sprite-style-meta"><span>{t(source.group)}</span><span className="sprite-format">{source.extension.toUpperCase()}</span></span>
      <span className="sprite-style-preview">{hasPikachu?<PokemonImage pokemon={{pokemonId:25,name:"Pikachu",shiny}} style={source.id} variant={previewVariant} size={112} fallback={false}/>:<span className="sprite-preview-unavailable"><ImageOff size={27} aria-hidden="true"/>{t("Pikachu indisponible")}</span>}</span>
      <strong>{t(source.label)}</strong><span className="sprite-style-check" aria-hidden="true">{active&&<Check size={13}/>}</span>
     </button>;
    })}</div>:<div className="empty-state"><Search size={26} aria-hidden="true"/><p>{t("Aucun style trouvé.")}</p><button type="button" className="button secondary" onClick={()=>{setQuery("");setGroup("all");}}>{t("Effacer les filtres")}</button></div>}
   </div>
  </div>
 </Modal>;
}
