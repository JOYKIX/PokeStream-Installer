"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Mars, Minus, RefreshCw, Trash2, Venus } from "lucide-react";
import { pokemonName, localizedForms } from "@/i18n/pokemon";
import { useI18n } from "@/i18n/client";
import { itemName, findItem, ITEMS } from "@/lib/items";
import { TYPE_LABELS, type Pokemon } from "@/lib/model";
import type { PokemonForm } from "@/lib/pokemon";
import { spriteSource, type SpriteStyle, type SpriteVariant } from "@/lib/sprite-options";
import { Select, SelectOption } from "./select";
import { NumberInput } from "./number-input";
import { ChoiceGroup } from "./choice-group";
import { PokemonImage } from "./pokemon-image";
import { Modal, Toggle } from "./ui";

export function PokemonEditor({pokemon,slot,onClose,onSave,onRemove,onReplace,onMove,spriteStyle,spriteVariant}:{
  pokemon:Pokemon; slot:number; onClose:()=>void; onSave:(p:Pokemon)=>void;
  onRemove:()=>void; onReplace:()=>void; onMove:(direction:-1|1,draft:Pokemon)=>void;
  spriteStyle?:SpriteStyle; spriteVariant?:SpriteVariant;
}) {
  const {t,locale}=useI18n(),fieldId=useId();
  const [draft,setDraft]=useState(pokemon),[forms,setForms]=useState<PokemonForm[]>([]),[formError,setFormError]=useState(false);
  useEffect(()=>{
    if(pokemon.isEgg)return;
    const controller=new AbortController();
    fetch(`/api/pokemon/${pokemon.speciesId}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();return response.json();}).then(data=>setForms(data.forms)).catch(error=>{if(error.name!=="AbortError")setFormError(true);});
    return()=>controller.abort();
  },[pokemon.speciesId,pokemon.isEgg]);
  const itemOptions=useMemo(()=>ITEMS.map(option=><option key={option.slug} value={itemName(option,locale)}/>),[locale]);
  const patch=(change:Partial<Pokemon>)=>setDraft(old=>({...old,...change}));
  const name=pokemonName({...draft,nickname:""},locale),item=findItem(draft.item),listId=fieldId+"-items";
  return <Modal open onOpenChange={open=>!open&&onClose()} title={name} className={"pokemon-editor-modal"+(draft.isEgg?" is-egg":"")}>
    <form className="pokemon-edit-form" onSubmit={event=>{event.preventDefault();onSave(draft);onClose();}}>
      <div className="pokemon-editor-body" data-egg={draft.isEgg||undefined}>
        <aside className="pokemon-editor-preview" aria-label={t("Aperçu")}>
          {!draft.isEgg&&<span className="pokemon-editor-number">#{String(draft.speciesId).padStart(3,"0")}</span>}
          <div className="pokemon-editor-image"><PokemonImage pokemon={draft} style={spriteStyle} variant={spriteVariant} fallbackStyle="home" size={210}/></div>
          {!draft.isEgg&&<div className="type-pills">{draft.types.map(type=><span className={"type-pill type-"+type} key={type}>{t(TYPE_LABELS[type])}</span>)}</div>}
          <div className="pokemon-editor-art-label"><small>{t("Illustrations")}</small><span>{t(spriteSource(spriteStyle??"artwork").label)}</span></div>
          <button type="button" className="button secondary" onClick={onReplace}><RefreshCw size={15}/>{t("Remplacer")}</button>
          <div className="pokemon-editor-position"><span>{t("Position")} <strong>{slot+1} / 6</strong></span><div><button type="button" disabled={slot===0} className="icon-button" aria-label={t("Déplacer à gauche")} onClick={()=>onMove(-1,draft)}><ArrowLeft size={17}/></button><button type="button" disabled={slot===5} className="icon-button" aria-label={t("Déplacer à droite")} onClick={()=>onMove(1,draft)}><ArrowRight size={17}/></button></div></div>
        </aside>
        {!draft.isEgg&&<div className="pokemon-editor-fields">
          <fieldset className="pokemon-editor-section"><legend>{t("Identité")}</legend>
            <div className="pokemon-identity-row"><label className="field">{t("Surnom")}<input value={draft.nickname} placeholder={name} maxLength={24} onChange={event=>patch({nickname:event.target.value})}/></label><div className="field"><label htmlFor={fieldId+"-level"}>{t("Niveau")}</label><NumberInput id={fieldId+"-level"} label={t("Niveau")} required min={1} max={100} value={draft.level} onValueChange={value=>patch({level:Number(value)})}/></div></div>
            <div className="field"><label htmlFor={fieldId+"-form"}>{t("Forme")}</label><Select id={fieldId+"-form"} aria-label={t("Forme")} presentation="dropdown" disabled={forms.length<=1} value={draft.pokemonId} onValueChange={value=>{const form=forms.find(f=>f.id===Number(value));if(form)patch({pokemonId:form.id,apiName:form.name,types:form.types,form:undefined,formSprite:undefined});}}>
              {!forms.length&&<SelectOption value={draft.pokemonId}>{formError?t("Indisponible"):t("Chargement…")}</SelectOption>}
              {forms.map(form=><SelectOption key={form.id} value={form.id}>{form.label==="Classique"?t("Classique"):localizedForms[locale]?.[String(form.id)]||t(form.labelEn||form.label)||form.name}</SelectOption>)}
            </Select></div>
            <div className="field"><span>{t("Sexe")}</span><ChoiceGroup label={t("Sexe")} columns={3} value={draft.gender??"unknown"} onChange={value=>patch({gender:value})} className="pokemon-gender-choices" options={[{value:"unknown",label:<><Minus size={15}/><span>{t("Non renseigné")}</span></>},{value:"male",label:<><Mars size={15}/><span>{t("Mâle")}</span></>},{value:"female",label:<><Venus size={15}/><span>{t("Femelle")}</span></>}]}/></div>
          </fieldset>
          <fieldset className="pokemon-editor-section"><legend>{t("Objet tenu")}</legend><label className="field"><span className="sr-only">{t("Objet tenu")}</span><input list={listId} value={item?itemName(item,locale):draft.item} maxLength={40} placeholder={t("Aucun")} onChange={event=>patch({item:findItem(event.target.value)?.slug||event.target.value})}/></label><datalist id={listId}>{itemOptions}</datalist></fieldset>
          <fieldset className="pokemon-editor-section"><legend>{t("État")}</legend>
            <div className="pokemon-state-options"><Toggle label={t("Chromatique")} checked={draft.shiny} onChange={shiny=>patch({shiny})}/><Toggle label="K.O." checked={draft.fainted} onChange={fainted=>patch({fainted,...(draft.hp!==undefined?{hp:fainted?0:Math.max(1,draft.hp)}:{})})}/></div>
            <Toggle label={t("Renseigner les PV")} checked={draft.maxHp!==undefined} onChange={enabled=>patch(enabled?{hp:draft.fainted?0:1,maxHp:1}:{hp:undefined,maxHp:undefined})}/>
            {draft.maxHp!==undefined&&<div className="pokemon-health-fields"><div className="pokemon-health-values"><div className="field"><label htmlFor={fieldId+"-hp"}>{t("PV actuels")}</label><NumberInput id={fieldId+"-hp"} label={t("PV actuels")} required min={0} max={draft.maxHp} value={draft.hp??0} onValueChange={value=>patch({hp:Number(value),fainted:Number(value)===0})}/></div><div className="field"><label htmlFor={fieldId+"-max-hp"}>{t("PV maximum")}</label><NumberInput id={fieldId+"-max-hp"} label={t("PV maximum")} required min={1} max={2047} value={draft.maxHp} onValueChange={value=>{const maxHp=Number(value);patch({maxHp,hp:Math.min(draft.hp??0,maxHp)});}}/></div></div><progress aria-label={t("Points de vie")} max={Math.max(1,draft.maxHp)} value={draft.hp??0}/></div>}
          </fieldset>
        </div>}
      </div>
      <div className="pokemon-editor-actions"><button type="button" className="button danger-ghost" onClick={()=>{onRemove();onClose();}}><Trash2 size={16}/>{t("Retirer")}</button><div><button type="button" className="button secondary" onClick={onClose}>{t("Annuler")}</button><button type="submit" className="button primary">{t("Appliquer")}</button></div></div>
    </form>
  </Modal>;
}
