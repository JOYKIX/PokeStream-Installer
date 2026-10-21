"use client";
import { customFavoriteId } from "./favorite-id";
import { CustomThemeSample } from "./custom/sample";
import type { CustomTheme } from "./custom/schema";
import { useI18n } from "@/i18n/client";
import { useRef, useState } from "react";
import { LoaderCircle, Search, Star, X } from "lucide-react";
import { THEME_IDS, THEMES, THEME_COLLECTIONS, requiresPro, type StarterId, type ThemeId, type ThemeCollection } from "./catalog";
import { Select, SelectOption } from "@/components/select";
import { ThemeSample } from "./theme-sample";
import type { useThemeFavorites } from "./use-theme-favorites";

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").trim();
}
const searchNames = new Map(THEME_IDS.map((theme) => [theme, searchable([THEMES[theme].label, THEMES[theme].console, THEMES[theme].collection].filter(Boolean).join(" "))]));

type Props = {
  selected: ThemeId | null;
  customThemes: CustomTheme[];
  selectedCustomId?: string;
  onSelectCustom: (theme: CustomTheme) => void;
  starter: StarterId | null;
  premium: boolean;
  demo: boolean;
  favorites: ReturnType<typeof useThemeFavorites>;
  onSelect: (theme: ThemeId) => void;
  onMessage: (message: string) => void;
};

export function ThemeLibrary({ selected, customThemes, selectedCustomId, onSelectCustom, starter, premium, demo, favorites, onSelect, onMessage }: Props) {
  const { t: tr } = useI18n();
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<ThemeCollection | "all" | "custom">("all");
  const viewport = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const favoriteIds = new Set(favorites.favorites ?? []);
  const search = searchable(query);
  const visibleCustom = customThemes.filter((theme) => (collection === "all" || collection === "custom") && (filter === "all" || favoriteIds.has(customFavoriteId(theme.id))) && searchable(theme.name).includes(search));
  const visible = THEME_IDS.filter((id) => id !== "custom" &&
    (filter === "all" || favoriteIds.has(id)) && (collection === "all" || THEMES[id].collection === collection) &&
    (searchNames.get(id) + " " + searchable(tr(THEMES[id].label))).includes(search),
  );
  const waitingForFavorites = filter === "favorites" && favorites.favorites === null;
  function resetScroll() { if (viewport.current) viewport.current.scrollTop = 0; }

  return (
    <div className="theme-library">
      <div className="theme-library-filters" role="group" aria-label={tr("Filtrer les thèmes")}>
        <button type="button" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); resetScroll(); }}>{tr("Tous")}</button>
        <button type="button" aria-pressed={filter === "favorites"} onClick={() => { setFilter("favorites"); resetScroll(); }}>
          <Star size={12} fill="currentColor" aria-hidden="true" /> {tr(" Favoris")}</button>
        {favorites.loading && <LoaderCircle className="spin" size={13} aria-label={tr("Chargement des favoris")} />}
      </div>
      <label className="theme-search">
        <Search size={15} aria-hidden="true" />
        <input ref={searchInput} type="search" aria-label={tr("Rechercher un thème")} placeholder={tr("Rechercher un thème...")}
          value={query} onChange={(event) => { setQuery(event.target.value); resetScroll(); }} />
        {query && <button type="button" aria-label={tr("Effacer la recherche")} onClick={() => {
          setQuery(""); resetScroll(); searchInput.current?.focus();
        }}><X size={14} /></button>}
      </label>
      <div className="theme-collection-filter">
        <Select aria-label={tr("Collection de thèmes")} value={collection}
          onValueChange={(value) => { setCollection(value as ThemeCollection | "all" | "custom"); resetScroll(); }}>
          <SelectOption value="all">{tr("Toutes les collections")}</SelectOption>
          <SelectOption value="custom">{tr("Mes thèmes")}</SelectOption>
          {Object.entries(THEME_COLLECTIONS).map(([id, label]) => <SelectOption key={id} value={id}>{tr(label)}</SelectOption>)}
        </Select>
      </div>
      {favorites.error && <div className="theme-library-error" role="alert">
        <span>{tr(favorites.error)}</span>
        <button type="button" disabled={favorites.loading} onClick={() => void favorites.refresh()}>{tr("Actualiser")}</button>
      </div>}
      <div className="theme-library-scroll" ref={viewport} role="region" aria-label={tr("Bibliothèque de thèmes")} tabIndex={0}>
        {waitingForFavorites ? (
          <p className="theme-library-empty" role="status">{favorites.error ? tr("Favoris indisponibles.") : tr("Chargement des favoris…")}</p>
        ) : visible.length || visibleCustom.length ? (
          <div className="theme-collections">
            {visibleCustom.length > 0 && <section className="theme-collection"><h4>{tr("Mes thèmes")}</h4><div className="theme-options" role="list">
              {visibleCustom.map((theme) => {
                const favoriteId = customFavoriteId(theme.id);
                const favorite = favoriteIds.has(favoriteId);
                return <div className="theme-library-card" role="listitem" key={theme.id}>
                  <button type="button" className={"theme-choice " + (selected === "custom" && selectedCustomId === theme.id ? "selected" : "")}
                    aria-pressed={selected === "custom" && selectedCustomId === theme.id} 
                    onClick={() => onSelectCustom(theme)}>
                    <CustomThemeSample config={theme.config}/><span>{theme.name}</span>
                  </button>
                  <button type="button" className={"theme-favorite " + (favorite ? "is-favorite" : "")} aria-pressed={favorite}
                    disabled={favorites.favorites === null || favorites.pending.includes(favoriteId)}
                    aria-label={tr(favorite ? "Retirer {name} des favoris" : "Ajouter {name} aux favoris", { name: theme.name })}
                    onClick={() => void favorites.toggle(favoriteId, !favorite)}><Star size={15} fill={favorite ? "currentColor" : "none"}/></button>
                </div>;
              })}
            </div></section>}
            {(Object.keys(THEME_COLLECTIONS) as ThemeCollection[]).map((group) => {
              const themes = visible.filter((theme) => THEMES[theme].collection === group);
              return themes.length > 0 ? <section className="theme-collection" key={tr(group)}>
                <h4>{tr(THEME_COLLECTIONS[group])}</h4>
                <div className="theme-options" role="list">
                  {themes.map((theme) => {
                    const favorite = favoriteIds.has(theme);
                    const locked = requiresPro(theme, starter) && !premium;
                    const saving = favorites.pending.includes(theme);
                    const label = tr(THEMES[theme].label);
                    return (
                      <div className="theme-library-card" role="listitem" key={theme}>
                        <button type="button" className={"theme-choice " + (selected === theme ? "selected" : "")}
                          aria-label={label + (locked ? " · Pro" : "")} aria-disabled={locked} aria-pressed={selected === theme}
                          onClick={() => locked ? onMessage(tr("Le thème {name} nécessite Pro.", { name: label })) : onSelect(theme)}>
                          <ThemeSample theme={theme} />
                          <span>{tr(label)}
                            {theme === starter && <span className="starter-label">{tr("GRATUIT")}</span>}
                            
                          </span>
                        </button>
                        <button type="button" className={"theme-favorite " + (favorite ? "is-favorite" : "")}
                          disabled={saving || favorites.favorites === null} aria-pressed={favorite} aria-busy={saving}
                          aria-label={tr(favorite ? "Retirer {name} des favoris" : "Ajouter {name} aux favoris", { name: label })}
                          title={favorite ? tr("Retirer des favoris") : tr("Ajouter aux favoris")}
                          onClick={() => demo ? onMessage(tr("Connecte-toi pour enregistrer tes favoris.")) : void favorites.toggle(theme, !favorite)}>
                          <Star size={15} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section> : null;
            })}
          </div>
        ) : (
          <p className="theme-library-empty" role="status">
            {filter === "favorites" && !favoriteIds.size && !search ? tr("Aucun thème en favori.") : tr("Aucun thème trouvé.")}
          </p>
        )}
      </div>
    </div>
  );
}
