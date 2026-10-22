"use client";
import { useRef, useState } from "react";
import { Check, LoaderCircle, Search, Star, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useSpritePackPrompt } from "@/local/sprite-pack-prompt";
import { customFavoriteId } from "./favorite-id";
import { CustomThemeSample } from "./custom/sample";
import type { CustomTheme } from "./custom/schema";
import { THEME_IDS, THEMES, THEME_COLLECTIONS, type StarterId, type ThemeId, type ThemeCollection } from "./catalog";
import { ThemeSample } from "./theme-sample";
import type { useThemeFavorites } from "./use-theme-favorites";

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}
type Props = {
  selected: ThemeId | null; spriteLocked?: boolean; customThemes: CustomTheme[];
  selectedCustomId?: string; onSelectCustom: (theme: CustomTheme) => void;
  starter: StarterId | null; premium: boolean; demo: boolean;
  favorites: ReturnType<typeof useThemeFavorites>; onSelect: (theme: ThemeId) => void;
  onMessage: (message: string) => void;
};
export function ThemeLibrary({ spriteLocked=false, selected, customThemes, selectedCustomId, onSelectCustom, demo, favorites, onSelect, onMessage }: Props) {
  const { t } = useI18n();
  const spritePrompt = useSpritePackPrompt(!demo && !spriteLocked);
  const [filter, setFilter] = useState<"all" | "favorites" | "custom" | ThemeCollection>("all");
  const [query, setQuery] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const favoriteIds = new Set(favorites.favorites ?? []);
  const entries = [
    ...customThemes.map(theme => ({
      id: customFavoriteId(theme.id), label: theme.name, collection: "custom", search: theme.name,
      sample: <CustomThemeSample config={theme.config}/>, active: selected === "custom" && selectedCustomId === theme.id,
      choose: () => void spritePrompt.choose(theme.config.sprite, () => onSelectCustom(theme)),
    })),
    ...THEME_IDS.filter(id => id !== "custom").map(id => ({
      id, label: t(THEMES[id].label), collection: THEMES[id].collection,
      search: [id, THEMES[id].label, t(THEMES[id].label), THEMES[id].console, t(THEME_COLLECTIONS[THEMES[id].collection])].join(" "),
      sample: <ThemeSample theme={id}/>, active: selected === id,
      choose: () => void spritePrompt.choose(THEMES[id].defaultSprite, () => onSelect(id)),
    })),
  ];
  const search = searchable(query);
  const visible = entries.filter(entry => (filter === "all" || filter === "favorites" && favoriteIds.has(entry.id) || entry.collection === filter) && searchable(entry.search).includes(search));
  const collections = [{id:"custom", label:t("Mes thèmes")}, ...Object.entries(THEME_COLLECTIONS).map(([id,label]) => ({id,label:t(label)}))];
  const filters = [{id:"all", label:t("Tous"), count:entries.length}, {id:"favorites", label:t("Favoris"), count:entries.filter(e=>favoriteIds.has(e.id)).length}, ...collections.map(c=>({...c,count:entries.filter(e=>e.collection===c.id).length}))];
  const changeFilter = (id: typeof filter) => {setFilter(id); if(viewport.current) viewport.current.scrollTop=0;};
  const waiting = filter === "favorites" && favorites.favorites === null;
  return <div className="theme-browser">
    <div className="theme-browser-toolbar">
      <label className="theme-browser-search"><Search size={18} aria-hidden="true"/><input ref={searchInput} autoFocus type="search" aria-label={t("Rechercher un thème")} placeholder={t("Rechercher un thème...")} value={query} onChange={event=>{setQuery(event.target.value);if(viewport.current)viewport.current.scrollTop=0;}}/>{query&&<button type="button" className="icon-button" aria-label={t("Effacer la recherche")} onClick={()=>{setQuery("");searchInput.current?.focus();}}><X size={16}/></button>}</label>
      <span className="theme-browser-count" role="status">{t("{count} thèmes",{count:visible.length})}</span>
    </div>
    <div className="theme-browser-layout">
      <nav className="theme-browser-collections" aria-label={t("Collection de thèmes")}>
        {filters.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>changeFilter(item.id as typeof filter)}>{item.id==="favorites"&&<Star size={14} aria-hidden="true"/>}<span>{item.label}</span><small>{item.count}</small></button>)}
      </nav>
      <div className="theme-browser-results" ref={viewport} role="region" aria-label={t("Bibliothèque de thèmes")} tabIndex={0}>
        {favorites.error&&<div className="theme-library-error" role="alert"><span>{t(favorites.error)}</span><button type="button" disabled={favorites.loading} onClick={()=>void favorites.refresh()}>{t("Actualiser")}</button></div>}
        {waiting?<p className="theme-browser-empty" role="status"><LoaderCircle size={22} className="spin"/>{t("Chargement des favoris…")}</p>:visible.length?collections.map(collection=>{
          const items=visible.filter(entry=>entry.collection===collection.id);
          return items.length>0&&<section key={collection.id} className="theme-browser-section"><h3>{collection.label}</h3><div className="theme-browser-grid">
            {items.map(entry=>{const favorite=favoriteIds.has(entry.id);return <div key={entry.id} className="theme-browser-card">
              <button type="button" className="theme-browser-choice" aria-pressed={entry.active} aria-label={entry.label} onClick={entry.choose}>
                <span className="theme-browser-preview">{entry.sample}</span><span className="theme-browser-name">{entry.label}{entry.active&&<Check size={15} aria-hidden="true"/>}</span>
              </button>
              <button type="button" className="theme-browser-favorite" aria-pressed={favorite} disabled={favorites.favorites===null||favorites.pending.includes(entry.id)} aria-label={t(favorite?"Retirer {name} des favoris":"Ajouter {name} aux favoris",{name:entry.label})} onClick={()=>demo?onMessage(t("Favoris indisponibles.")):void favorites.toggle(entry.id,!favorite)}><Star size={16} fill={favorite?"currentColor":"none"}/></button>
            </div>;})}
          </div></section>;
        }):<div className="theme-browser-empty" role="status"><Search size={26}/><p>{t(filter==="favorites"&&!favoriteIds.size&&!query?"Aucun thème en favori.":"Aucun thème trouvé.")}</p><button type="button" className="button secondary" onClick={()=>{setQuery("");changeFilter("all");}}>{t("Effacer les filtres")}</button></div>}
      </div>
    </div>
    {spritePrompt.dialog}
  </div>;
}
