"use client";
import { LoaderCircle, Palette, ChevronDown, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { NumberInput } from "@/components/number-input";
import { ColorPicker } from "@/components/color-picker";
import { useI18n } from "@/i18n/client";
import dynamic from "next/dynamic";
import { Modal } from "@/components/ui";
import Link from "next/link";
import { useThemeFavorites } from "@/themes/use-theme-favorites";
const ThemeLibrary=dynamic(()=>import("@/themes/theme-library").then(m=>m.ThemeLibrary),{ssr:false,loading:()=> <div className="theme-picker-loading"><LoaderCircle className="spin" size={23}/></div>});
import {
  THEMES,
  type StarterId,
  type ThemeId,
} from "@/themes/catalog";
import type { CustomTheme } from "@/themes/custom/schema";
import type { ThemeRef } from "./schema";
export function NumberField({
  label,
  value,
  onChange,
  min = -3840,
  max = 3840,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="builder-field">
      <label htmlFor={id}>{t(label)}</label>
      <NumberInput
        id={id}
        label={t(label)}
        value={Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(value) => {
          if (value !== "" && Number.isFinite(Number(value)))
            onChange(Math.max(min, Math.min(max, Number(value))));
        }}
      />
    </div>
  );
}
export function ColorField({
  label,
  value,
  onChange,
  onReset,
  resetDisabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  resetDisabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="builder-color">
      <span>{t(label)}</span>
      <ColorPicker label={label} value={value} onChange={onChange} />
      <code>{value.toUpperCase()}</code>
      {onReset && (
        <button
          type="button"
          className="builder-reset"
          title={t("Réinitialiser la couleur")}
          aria-label={t("Réinitialiser la couleur")}
          disabled={resetDisabled}
          onClick={onReset}
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}
export function ThemeSelect({
  value,
  onChange,
  active,
  starter,
  themes,
  inherit = false,
  inheritLabel = "Thème principal",
  studio,
}: {
  value: ThemeRef | null;
  onChange: (v: ThemeRef | null) => void;
  active: boolean;
  starter: StarterId | null;
  themes: CustomTheme[];
  inherit?: boolean;
  inheritLabel?: string;
  studio?: { selected: boolean; onSelect: () => void };
}) {
  const { t } = useI18n();
  const [open,setOpen]=useState(false),[message,setMessage]=useState("");
  const favorites=useThemeFavorites(open,false);
  const label=studio?.selected?t("Profil Studio"):!value?t(inheritLabel):value.id==="custom"?themes.find(theme=>theme.id===value.customId)?.name||t("Mes thèmes"):t(THEMES[value.id].label);
  function choose(next:ThemeRef|null){onChange(next);setOpen(false);}
  return <>
   <button type="button" className="theme-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setMessage("");setOpen(true);}}><Palette size={16}/><span>{label}</span><ChevronDown size={15}/></button>
   <Modal open={open} onOpenChange={setOpen} title={t("Choisir un thème")} className="theme-browser-modal" wide>
    <div className="theme-picker-dialog">
     {(inherit||studio)&&<div className="theme-picker-inheritance">
      {inherit&&<button type="button" aria-pressed={!value&&!studio?.selected} onClick={()=>choose(null)}>{t(inheritLabel)}</button>}
      {studio&&<button type="button" aria-pressed={studio.selected} onClick={()=>{studio.onSelect();setOpen(false);}}>{t("Profil Studio")}</button>}
     </div>}
     {message&&<p role="status" className="builder-note">{message}</p>}
     {open&&<ThemeLibrary selected={studio?.selected||!value?null:value.id} selectedCustomId={value?.id==="custom"?value.customId:undefined} customThemes={themes} onSelectCustom={theme=>choose({id:"custom",customId:theme.id})} starter={starter} premium={active} demo={false} favorites={favorites} onSelect={(id:ThemeId)=>choose({id})} onMessage={setMessage}/>}
    </div>
    <div className="theme-browser-footer"><Link href="/theme-creator" className="button secondary"><Palette size={16}/>{t("Créer un thème")}</Link><button type="button" className="button secondary" onClick={()=>setOpen(false)}>{t("Fermer")}</button></div>
   </Modal>
  </>;
}
