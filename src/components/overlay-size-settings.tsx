"use client";
import { useI18n } from "@/i18n/client";
import { RotateCcw } from "lucide-react";
import { TEAM_ELEMENTS, teamElementOrder, type SceneData } from "@/lib/model";
import { badgeColumnOptions, badgeLayout, itemSpriteScale, teamLayout } from "@/lib/overlay-layout";
import {ChoiceGroup,TeamLayoutChoices} from "./choice-group";
import { OverlayElementOrder } from "./overlay-element-order";
import { Range } from "./range";
import { Toggle } from "./ui";
import { TypeBadgePicker } from "./type-badge-picker";

const teamElements = [
  ["showSprites", "spriteScale", "Sprite", true],
  ["showNames", "nameScale", "Nom", true],
  ["showLevels", "levelScale", "Niveau", true],
  ["showTypes", "typeScale", "Types", true],
  ["showGender", "genderScale", "Sexe", false],
  ["showHealth", "healthScale", "Barre de vie", false],
] as const;

function SizeField({
  label, value, onChange, controlLabel = label,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  controlLabel?: string;
}) {
  const { t: tr } = useI18n();
  const resetLabel = tr("Réinitialiser la taille — ") + tr(controlLabel) + " (100 %)";
  return (
    <div className="field size-field">
      <div className="size-field-label">
        <span>{tr(label)}</span><span>{Math.round(value * 100)} %</span>
      </div>
      <div className="size-field-control">
        <Range
          label={tr("Taille — ") + tr(controlLabel)}
          valueText={Math.round(value * 100) + " %"}
          min={0.5} max={2} step={0.05}
          value={value} onValueChange={onChange}
        />
        <button
          type="button" className="size-reset"
          title={resetLabel} aria-label={resetLabel}
          disabled={value === 1} onClick={() => onChange(1)}
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function OverlaySizeSettings({
  style, nuzlocke, badgeCount, onChange, section="all",
}: {
  section?:"all"|"team"|"badges"|"deaths";
  style: SceneData["style"];
  nuzlocke: boolean;
  badgeCount: number;
  onChange: (patch: Partial<SceneData["style"]>) => void;
}) {
  const { t: tr } = useI18n();
  const showSprites = style.showSprites !== false;
  const enabledOrder = { sprite: showSprites, name: style.showNames, level: style.showLevels,
    types: style.showTypes, health: style.showHealth ?? false };
  const visibleElements = TEAM_ELEMENTS.filter((element) => enabledOrder[element]);
  const hasChanges = [
    style.scale,
    style.teamScale ?? style.scale,
    style.badgeScale ?? style.scale,
    style.deathScale ?? style.scale,
    ...teamElements.map(([, key]) => style[key] ?? 1),
    style.itemScale ?? 1, itemSpriteScale(style),
  ].some((value) => value !== 1) ||
    teamElementOrder(style.elementOrder).some((item, i) => item !== TEAM_ELEMENTS[i]) ||
    teamLayout(style) !== "6x1" || (badgeCount > 0 && badgeLayout(style, badgeCount) !== badgeCount);

  function resetAll() {
    onChange({
      scale: 1, teamScale: 1, badgeScale: 1, deathScale: 1,
      spriteScale: 1, nameScale: 1, levelScale: 1, typeScale: 1, genderScale: 1, healthScale: 1, itemScale: 1, itemSpriteScale: 1,
      orientation: "horizontal", teamLayout: "6x1", badgeColumns: badgeCount || "auto",
      elementOrder: [...TEAM_ELEMENTS],
    });
  }

  return <div className="inspector-section size-settings-panel">
   <div className="size-settings-heading"><h3>{tr(section==="team"?"Équipe":section==="badges"?"Badges":section==="deaths"?"Compteur Nuzlocke":"Tailles et disposition")}</h3><button type="button" className="size-reset" title={tr("Réinitialiser toutes les tailles et la disposition")} aria-label={tr("Réinitialiser toutes les tailles et la disposition")} disabled={!hasChanges} onClick={resetAll}><RotateCcw size={16}/></button></div>
   {(section==="all"||section==="team")&&<>
    <div className="size-settings-group"><h4>{tr("Disposition")}</h4><TeamLayoutChoices value={teamLayout(style)} onChange={teamLayout=>onChange({teamLayout})}/>
     <SizeField label={tr("Taille générale")} controlLabel={tr("Équipe")} value={style.teamScale??style.scale} onChange={teamScale=>onChange({teamScale})}/>
    </div>
    <div className="size-settings-group"><h4>{tr("Éléments affichés")}</h4><div className="team-size-options">{teamElements.map(([visibleKey,scaleKey,label,defaultEnabled])=>{
     const enabled=style[visibleKey]??defaultEnabled;
     return <div className="element-size-setting" key={visibleKey}><Toggle label={tr(label)} checked={enabled} onChange={visible=>onChange({[visibleKey]:visible})}/>{enabled&&<div className="element-size-range"><SizeField label={tr("Taille")} controlLabel={tr(label)} value={style[scaleKey]??1} onChange={size=>onChange({[scaleKey]:size})}/>{visibleKey==="showTypes"&&<TypeBadgePicker value={style.typeBadgeStyle??style.customTheme?.types.badgeStyle??"text"} onChange={typeBadgeStyle=>onChange({typeBadgeStyle})}/>}
{visibleKey==="showHealth"&&<Toggle label={tr("Valeurs des PV")} checked={style.showHealthValues!==false} onChange={showHealthValues=>onChange({showHealthValues})}/>}</div>}</div>;
    })}
     <div className="element-size-setting"><Toggle label={tr("Objet tenu")} checked={style.showItems&&showSprites} disabled={!showSprites} onChange={showItems=>onChange({showItems})}/>{style.showItems&&showSprites&&<div className="element-size-range"><SizeField label={tr("Contenant")} controlLabel={tr("Contenant de l’objet tenu")} value={style.itemScale??1} onChange={itemScale=>onChange({itemScale,itemSpriteScale:itemSpriteScale(style)})}/><SizeField label="Sprite" controlLabel={tr("Sprite de l’objet tenu")} value={itemSpriteScale(style)} onChange={itemSpriteScale=>onChange({itemSpriteScale})}/></div>}</div>
    </div></div>
    {visibleElements.length>0&&<div className="size-settings-group element-order-settings"><h4>{tr("Ordre des éléments")}</h4><OverlayElementOrder key={visibleElements.join(",")} value={style.elementOrder} visible={visibleElements} onChange={elementOrder=>onChange({elementOrder})}/></div>}
   </>}
   {(section==="all"||section==="badges")&&<div className="size-settings-group"><Toggle label={tr("Afficher les badges")} checked={style.showBadges} onChange={showBadges=>onChange({showBadges})}/>{badgeCount>0?style.showBadges&&<>
    <div className="field badge-layout-field"><span>{tr("Disposition")}</span><ChoiceGroup label={tr("Disposition des badges")} value={style.badgeColumns==="auto"?"auto":String(badgeLayout(style,badgeCount))} columns={3} onChange={value=>onChange({badgeColumns:value==="auto"?"auto":Number(value)})} options={[{value:"auto",label:tr("Auto")},...badgeColumnOptions(badgeCount).map(columns=>({value:String(columns),label:columns+" × "+badgeCount/columns}))]}/></div>
    <Toggle label={tr("Fond des badges")} checked={style.badgeBackground??false} onChange={badgeBackground=>onChange({badgeBackground})}/>
    <SizeField label={tr("Taille")} controlLabel="Badges" value={style.badgeScale??style.scale} onChange={badgeScale=>onChange({badgeScale})}/>
   </>:<p className="muted small">{tr("Aucun badge pour ce jeu.")}</p>}</div>}
   {(section==="all"||section==="deaths")&&(nuzlocke?<div className="size-settings-group"><SizeField label={tr("Taille")} controlLabel={tr("Compteur Nuzlocke")} value={style.deathScale??style.scale} onChange={deathScale=>onChange({deathScale})}/></div>:<p className="muted small">{tr("Active le mode Nuzlocke dans les réglages du profil.")}</p>)}
  </div>;
}
