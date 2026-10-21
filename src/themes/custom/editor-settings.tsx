"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { SpriteSelector } from "@/components/sprite-selector";
import { Toggle } from "@/components/ui";
import { ColorControl, RangeControl, SurfaceControls, ChoiceControl } from "./controls";
import { customThemeVariables } from "./appearance";
import { themePreview } from "./preview";
import { defaultCustomTheme, TYPE_COLORS, type ThemeType, type CustomThemeConfig } from "./schema";
import { TYPE_LABELS } from "@/lib/model";
import type { Section } from "./editor-options";
const defaults = defaultCustomTheme();
export function ThemeSettings({config,section,onChange}:{config:CustomThemeConfig;section:Section;onChange:(config:CustomThemeConfig,key:string)=>void}){
 const {t}=useI18n();
 function set<K extends keyof CustomThemeConfig>(key:K,value:CustomThemeConfig[K]){onChange({...config,[key]:value},key);}
 return <>
         {section === "general" && <div className="ts-control-stack">
           <ColorControl label="Couleur d’accent" value={config.accent} reset={defaults.accent} onChange={(v) => set("accent", v)}/>
           <ChoiceControl label="Police" value={config.font} choices={[["inter","Classique"],["space","Géométrique"],["pixel","Pixel"]]} onChange={(v) => set("font", v)}/>
           <ChoiceControl label="Alignement du texte" value={config.align} choices={[["left","Gauche"],["center","Centre"],["right","Droite"]]} onChange={(v) => set("align", v)}/>
           <ChoiceControl label="Ombre" value={config.shadow} choices={[["none","Aucune"],["soft","Douce"],["crisp","Nette"]]} onChange={(v) => set("shadow", v)}/>
           <RangeControl label="Espacement des cartes" min={4} max={28} value={config.spacing} reset={defaults.spacing} onChange={(v) => set("spacing",v)}/>
         </div>}
         {section === "card" && <><RangeControl label="Largeur minimale" min={160} max={360} value={config.cardWidth} reset={defaults.cardWidth} onChange={(v) => set("cardWidth",v)}/><RangeControl label="Marge intérieure" max={32} value={config.cardPadding} reset={defaults.cardPadding} onChange={(v) => set("cardPadding",v)}/><RangeControl label="Espacement des éléments" max={24} value={config.contentGap} reset={defaults.contentGap} onChange={(v) => set("contentGap",v)}/><SurfaceControls value={config.card} defaults={defaults.card} onChange={(v) => set("card", v)}/>
           <ChoiceControl label="Liseré d’accent" value={config.cardAccent} choices={[["none","Aucun"],["top","En haut"],["bottom","En bas"],["left","À gauche"],["right","À droite"]]} onChange={(v) => set("cardAccent",v)}/>{config.cardAccent !== "none" && <RangeControl label="Épaisseur du liseré" min={1} max={8} value={config.accentWidth} reset={defaults.accentWidth} onChange={(v) => set("accentWidth",v)}/>}</>}
         {section === "sprite" && <><SpriteSelector style={themePreview(config).style} onChange={(p) => onChange({ ...config, sprite: p.sprite ?? config.sprite, spriteVariant: p.spriteVariant ?? config.spriteVariant }, "sprite")}/>
           <ChoiceControl label="Effet du sprite" value={config.spriteEffect} choices={[["none","Aucun"],["shadow","Ombre"],["glow","Halo d’accent"]]} onChange={(v) => set("spriteEffect",v)}/>
           <RangeControl label="Rotation du sprite" min={-20} max={20} unit="°" value={config.spriteRotation} reset={0} onChange={(v) => set("spriteRotation",v)}/>
           <Toggle label="Fond du sprite" checked={config.spritePanelVisible} onChange={(v) => set("spritePanelVisible",v)}/>
           {config.spritePanelVisible && <SurfaceControls value={config.spritePanel} defaults={defaults.spritePanel} onChange={(v) => set("spritePanel",v)}/>}
         </>}
         {section === "text" && (["name","level"] as const).map((key) => <div className="ts-subsection" key={key}><h3>{t(key === "name" ? "Nom" : "Niveau")}</h3>
           <ColorControl label="Couleur du texte" value={config[key].color} reset={defaults[key].color} onChange={(color) => set(key,{ ...config[key], color })}/>
           <RangeControl label="Taille" unit="%" min={50} max={160} value={config[key].size} reset={defaults[key].size} onChange={(size) => set(key,{ ...config[key], size })}/>
           <Toggle label="Gras" checked={config[key].bold} onChange={(bold) => set(key,{ ...config[key], bold })}/><Toggle label="Majuscules" checked={config[key].uppercase} onChange={(uppercase) => set(key,{ ...config[key], uppercase })}/><RangeControl label="Espacement des lettres" min={-2} max={6} value={config[key].tracking} reset={0} onChange={(tracking) => set(key,{...config[key],tracking})}/><ChoiceControl label="Relief du texte" value={config[key].shadow} choices={[["none","Aucun"],["soft","Ombre"],["outline","Contour"]]} onChange={(shadow) => set(key,{...config[key],shadow})}/>
         </div>)}
         {section === "types" && <div className="ts-control-stack">
           <ChoiceControl label="Rendu des types" value={config.types.mode} choices={[["tonal","Teinté"],["solid","Plein"],["outline","Contour"]]} onChange={(mode) => set("types",{...config.types,mode})}/>
           <Toggle label="Couleurs des types" checked={config.types.natural} onChange={(natural) => set("types",{...config.types,natural})}/>
           {config.types.natural && <TypePalette config={config} onChange={(types) => set("types",types)}/>}
           {config.types.mode === "tonal" && <RangeControl label="Intensité du fond" max={100} unit="%" value={config.types.intensity} reset={18} onChange={(intensity) => set("types",{...config.types,intensity})}/>}
           {!config.types.natural && <><ColorControl label="Couleur du texte" value={config.types.color} reset={defaults.types.color} onChange={(color) => set("types",{...config.types,color})}/>
           {config.types.mode !== "outline" && <ColorControl label="Fond" value={config.types.background} reset={defaults.types.background} onChange={(background) => set("types",{...config.types,background})}/>}</>}
           <RangeControl label="Arrondi" value={config.types.radius} reset={defaults.types.radius} onChange={(radius) => set("types",{...config.types,radius})}/>
           <RangeControl label="Taille" unit="%" min={50} max={160} value={config.types.size} reset={defaults.types.size} onChange={(size) => set("types",{...config.types,size})}/>
         </div>}
         {section === "gender" && <div className="ts-control-stack">
           <ColorControl label="Mâle" value={config.gender.male} reset={defaults.gender.male} onChange={(male) => set("gender",{...config.gender,male})}/>
           <ColorControl label="Femelle" value={config.gender.female} reset={defaults.gender.female} onChange={(female) => set("gender",{...config.gender,female})}/>
           <RangeControl label="Arrondi" value={config.gender.radius} reset={defaults.gender.radius} onChange={(radius) => set("gender",{...config.gender,radius})}/>
         </div>}
         {section === "item" && <><SurfaceControls value={config.item} defaults={defaults.item} onChange={(v) => set("item",v)}/><RangeControl label="Taille du sprite de l’objet" min={50} max={200} unit="%" value={config.sizes.itemSprite} reset={100} onChange={(itemSprite) => set("sizes",{...config.sizes,itemSprite})}/></>}
         {section === "health" && <div className="ts-control-stack">
           {([["high","PV élevés"],["medium","PV moyens"],["low","PV faibles"],["track","Fond"],["text","Couleur du texte"],["border","Bordure"]] as const).map(([key,label]) =>
             <ColorControl key={key} label={label} value={config.health[key]} reset={defaults.health[key]} onChange={(v) => set("health",{...config.health,[key]:v})}/>)}
           <RangeControl label="Épaisseur" min={4} max={18} value={config.health.height} reset={defaults.health.height} onChange={(height) => set("health",{...config.health,height})}/>
           <RangeControl label="Arrondi" value={config.health.radius} reset={defaults.health.radius} onChange={(radius) => set("health",{...config.health,radius})}/>
           <Toggle label="Barre segmentée" checked={config.health.striped} onChange={(striped) => set("health",{...config.health,striped})}/>
         </div>}
         {section === "badges" && <><RangeControl label="Espacement des badges" max={30} value={config.badgeGap} reset={10} onChange={(v) => set("badgeGap",v)}/><RangeControl label="Marge du boîtier" max={32} value={config.badgePadding} reset={12} onChange={(v) => set("badgePadding",v)}/><SurfaceControls value={config.badges} defaults={defaults.badges} onChange={(v) => set("badges",v)}/><p className="ts-muted">{t("Le fond des badges reste activable dans le Studio.")}</p></>}
         {section === "counter" && <><ChoiceControl label="Disposition" value={config.counterLayout} choices={[["horizontal","Horizontale"],["vertical","Verticale"]]} onChange={(v) => set("counterLayout",v)}/><Toggle label="Afficher l’icône" checked={config.counterIconVisible} onChange={(v) => set("counterIconVisible",v)}/><SurfaceControls value={config.counter} defaults={defaults.counter} onChange={(v) => set("counter",v)}/>
           <ColorControl label="Couleur du texte" value={config.counterText} reset={defaults.counterText} onChange={(v) => set("counterText",v)}/>
           <ColorControl label="Couleur de l’icône" value={config.counterIcon} reset={defaults.counterIcon} onChange={(v) => set("counterIcon",v)}/></>}
         {(["sprite","gender","item","badges","counter"] as const).filter((key) => key === section).map((key) =>
           <RangeControl key={key} label={key === "item" ? "Taille du contenant" : "Taille"} unit="%" min={50} max={160} value={config.sizes[key]} reset={100} onChange={(value) => set("sizes",{...config.sizes,[key]:value})}/>)}

 </>;
}
function TypePalette({config,onChange}:{config:CustomThemeConfig;onChange:(types:CustomThemeConfig["types"])=>void}) {
 const {t}=useI18n(); const [selected,setSelected]=useState<ThemeType>("fire");
 return <div className="ts-type-palette">
 <div className="ts-type-grid theme-custom" data-type-colors="natural" data-type-mode={config.types.mode} style={customThemeVariables(config)}>
 {(Object.keys(TYPE_COLORS) as ThemeType[]).map((type)=><button type="button" className={"type-pill type-"+type} key={type} aria-pressed={selected===type} onClick={()=>setSelected(type)}>{t(TYPE_LABELS[type])}</button>)}
 </div>
 <ColorControl label={TYPE_LABELS[selected]} value={config.types.palette[selected]} reset={TYPE_COLORS[selected]} onChange={(color)=>onChange({...config.types,palette:{...config.types.palette,[selected]:color}})}/>
 </div>;
}
