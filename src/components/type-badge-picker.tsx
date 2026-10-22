"use client";
import { useState } from "react";
import { ChevronRight, Check, Search, Type } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { TYPE_BADGE_STYLES } from "@/lib/type-badges";
import { useSpritePackPrompt } from "@/local/sprite-pack-prompt";
import { Modal } from "./ui";
import { ChoiceGroup } from "./choice-group";
import { TypeBadge } from "./type-badge";
export function TypeBadgePicker({value="text",onChange,inherit}:{value?:string;onChange:(value:string)=>void;inherit?:{active:boolean;label:string;onSelect:()=>void}}) {
  const {t,locale}=useI18n(),[open,setOpen]=useState(false),[query,setQuery]=useState("");
  const [language,setLanguage]=useState<"fr"|"en">(TYPE_BADGE_STYLES.find(s=>s.id===value)?.language??(locale==="fr"?"fr":"en"));
  const prompt=useSpritePackPrompt(true),current=TYPE_BADGE_STYLES.find(style=>style.id===value);
  const variant=(value:string)=>value.includes("Tera")?t("Téracristal")+ (value.includes("small")?" · "+t("Compact"):""):value?t("Compact"):"";
  const label=inherit?.active?t(inherit.label):current?(current.games??[current.label]).map(game=>t(game)).join(" / ")+(current.variant?" · "+variant(current.variant):""):t("Libellés traduits");
  const visible=TYPE_BADGE_STYLES.filter(style=>style.language===language&&((style.games??[style.label]).map(game=>t(game)).join(" / ")+" "+style.label+" "+variant(style.variant)+" "+style.generation+"G").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().includes(query.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().trim()));
  function choose(style:string){void prompt.choose(style==="text"||style.startsWith("fr-")?undefined:"type-badges",()=>{onChange(style);setOpen(false);});}
  return <>
    <button type="button" className="type-badge-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setLanguage(current?.language??(locale==="fr"?"fr":"en"));setOpen(true);}}><span className="type-badge-trigger-copy"><small>{t("Style des types")}</small><strong>{label}</strong>{current&&<span className="type-badge-language-tag">{current.language.toUpperCase()}</span>}</span><span className="type-badge-trigger-preview"><TypeBadge type="grass" style={value}/><TypeBadge type="fire" style={value}/></span><ChevronRight size={15}/></button>
    <Modal open={open} onOpenChange={setOpen} title={t("Style des types")} className="type-badge-modal" wide>
      <p className="type-badge-note">{t("Choisis une langue et un jeu. Un type absent utilise son libellé traduit.")}</p>
      <ChoiceGroup label={t("Langue des badges")} className="type-badge-languages" value={language} onChange={value=>{setLanguage(value);setQuery("");}} options={[{value:"fr",label:"Français"},{value:"en",label:"English"}]}/>
      <label className="theme-browser-search"><Search size={17}/><input autoFocus type="search" aria-label={t("Rechercher un jeu")} placeholder={t("Rechercher un jeu")} value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <div className="type-badge-catalog">
        {inherit&&<button type="button" className="type-badge-option text-option" aria-pressed={inherit.active} onClick={()=>{inherit.onSelect();setOpen(false);}}><Type size={23}/><strong>{t(inherit.label)}</strong>{inherit.active&&<Check size={16}/>}</button>}
        {!query&&<button type="button" className="type-badge-option text-option" aria-pressed={value==="text"&&!inherit?.active} onClick={()=>choose("text")}><span className="type-badge-option-preview"><TypeBadge type="grass"/><TypeBadge type="fire"/></span><strong>{t("Libellés traduits")}</strong>{value==="text"&&!inherit?.active&&<Check size={16}/>}</button>}
        {[3,4,5,6,7,8,9].map(generation=>{const styles=visible.filter(style=>style.generation===generation);return styles.length>0&&<section key={generation}><h3>{t("Génération {number}",{number:generation})}</h3><div className="type-badge-grid">{styles.map(style=><button key={style.id} type="button" className="type-badge-option" aria-pressed={style.id===value&&!inherit?.active} onClick={()=>choose(style.id)}><span className="type-badge-option-preview"><TypeBadge type="grass" style={style.id}/><TypeBadge type="fire" style={style.id}/></span><strong>{(style.games??[style.label]).map(game=>t(game)).join(" / ")}</strong>{style.variant&&<small>{variant(style.variant)}</small>}{style.id===value&&!inherit?.active&&<Check className="type-badge-selected" size={16}/>}</button>)}</div></section>;})}
        {!visible.length&&query&&<p className="theme-browser-empty" role="status">{t("Aucun résultat.")}</p>}
      </div>
      <div className="type-badge-footer"><span>{t(language==="fr"?"Badges français inclus, disponibles hors ligne.":"Hors ligne : pack Types dans la bibliothèque de sprites.")}</span><button type="button" className="button secondary" onClick={()=>setOpen(false)}>{t("Fermer")}</button></div>
      {prompt.dialog}
    </Modal>
  </>;
}
