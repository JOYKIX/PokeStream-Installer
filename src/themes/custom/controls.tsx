"use client";
import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Toggle } from "@/components/ui";
import { Range } from "@/components/range";
import { NumberInput } from "@/components/number-input";
import { ColorPicker } from "@/components/color-picker";
import { Select, SelectOption } from "@/components/select";
import type { ThemeSurface } from "./schema";

export function ColorControl({ label, value, onChange, reset }: { label: string; value: string; onChange: (v: string) => void; reset?: string }) {
 const { t } = useI18n();
 const id = useId();
 const [draft, setDraft] = useState<string | null>(null);
 return <div className="ts-color-row">
   <label htmlFor={id}>{t(label)}</label>
   <div className="ts-color-input">
     <ColorPicker label={label} value={value} onChange={(color) => { setDraft(null); onChange(color); }} />
     <input id={id} type="text" value={draft ?? value.toUpperCase()} maxLength={7} spellCheck={false}
       aria-label={t(label) + " · HEX"} onChange={(e) => { const v = e.target.value; setDraft(v); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v); }}
       onBlur={() => setDraft(null)} />
   </div>
   {reset && <button type="button" className="ts-reset" aria-label={t("Réinitialiser {name}", { name: t(label) })} title={t("Réinitialiser")} disabled={value.toLowerCase() === reset.toLowerCase()} onClick={() => { setDraft(null); onChange(reset); }}><RotateCcw size={13} /></button>}
 </div>;
}
export function RangeControl({ label, value, onChange, min = 0, max = 40, unit = "px", reset }: {
 label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string; reset: number;
}) {
 const { t } = useI18n();
 const id = useId();
 const [draft, setDraft] = useState<string | null>(null);
 function commit() {
   if (draft !== null && draft !== "" && Number.isFinite(Number(draft)))
     onChange(Math.max(min, Math.min(max, Math.round(Number(draft)))));
   setDraft(null);
 }
 return <div className="ts-range">
   <div><label htmlFor={id}>{t(label)}</label>
     <NumberInput id={id + "-value"} label={t(label)} value={draft ?? value} min={min} max={max}
       onValueChange={(v) => {
         setDraft(v);
         const n = Number(v);
         if (v !== "" && Number.isInteger(n) && n >= min && n <= max) onChange(n);
       }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />
     <span className="ts-unit">{unit}</span>
     <button type="button" className="ts-reset" disabled={value === reset && draft === null} onClick={() => { setDraft(null); onChange(reset); }} aria-label={t("Réinitialiser {name}", { name: t(label) })} title={t("Réinitialiser")}><RotateCcw size={13}/></button></div>
   <Range id={id} label={label} min={min} max={max} step={1} value={value} valueText={value + " " + unit} onValueChange={(next) => { setDraft(null); onChange(next); }} />
 </div>;
}
export function ChoiceControl<T extends string>({ label, value, choices, onChange }: { label: string; value: T; choices: ReadonlyArray<readonly [T, string]>; onChange: (v: T) => void }) {
 const { t } = useI18n();
 return <label className="field">{t(label)}<Select value={value} aria-label={t(label)} onValueChange={(v) => onChange(v as T)}>
   {choices.map(([id, text]) => <SelectOption key={id} value={id}>{t(text)}</SelectOption>)}
 </Select></label>;
}
export function SurfaceControls({ value, defaults, onChange }: { value: ThemeSurface; defaults: ThemeSurface; onChange: (v: ThemeSurface) => void }) {
 const patch = (p: Partial<ThemeSurface>) => onChange({ ...value, ...p });
 return <div className="ts-control-stack">
   <ColorControl label="Fond" value={value.color} reset={defaults.color} onChange={(color) => patch({ color })} />
   <Toggle label="Dégradé" checked={value.gradient} onChange={(gradient) => patch({ gradient })} />
   {value.gradient && <><ColorControl label="Seconde couleur" value={value.colorEnd} reset={defaults.colorEnd} onChange={(colorEnd) => patch({ colorEnd })} />
   <ChoiceControl label="Forme du dégradé" value={value.gradientMode} choices={[["linear","Linéaire"],["radial","Radial"]]} onChange={(gradientMode) => patch({gradientMode})}/>
   {value.gradientMode === "linear" && <RangeControl label="Angle du dégradé" max={360} unit="°" value={value.angle} reset={defaults.angle} onChange={(angle) => patch({angle})}/>}</>}
   <RangeControl label="Opacité du fond" unit="%" max={100} value={value.opacity} reset={defaults.opacity} onChange={(opacity) => patch({ opacity })}/>
   <RangeControl label="Arrondi" value={value.radius} reset={defaults.radius} onChange={(radius) => patch({ radius })}/>
   <RangeControl label="Épaisseur de bordure" max={4} value={value.borderWidth} reset={defaults.borderWidth} onChange={(borderWidth) => patch({ borderWidth })}/>
   {value.borderWidth > 0 && <><ColorControl label="Bordure" value={value.border} reset={defaults.border} onChange={(border) => patch({ border })}/><ChoiceControl label="Trait de bordure" value={value.borderStyle} choices={[["solid","Continu"],["dashed","Pointillés"],["double","Double"]]} onChange={(borderStyle) => patch({borderStyle})}/></>}
   <ChoiceControl label="Texture" value={value.pattern} choices={[["none","Aucune"],["dots","Points"],["grid","Grille"],["lines","Diagonales"]]} onChange={(pattern) => patch({pattern})}/>
   {value.pattern !== "none" && <><ColorControl label="Couleur de la texture" value={value.patternColor} reset={defaults.patternColor} onChange={(patternColor) => patch({patternColor})}/><RangeControl label="Intensité de la texture" max={50} unit="%" value={value.patternOpacity} reset={defaults.patternOpacity} onChange={(patternOpacity) => patch({patternOpacity})}/><RangeControl label="Échelle de la texture" min={4} max={40} value={value.patternScale} reset={defaults.patternScale} onChange={(patternScale) => patch({patternScale})}/></>}
 </div>;
}

