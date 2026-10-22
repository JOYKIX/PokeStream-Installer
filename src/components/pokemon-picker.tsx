"use client";
import { localizedSpecies, speciesName } from "@/i18n/pokemon";
import { useI18n } from "@/i18n/client";
import { Select, SelectOption } from "./select";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import catalog from "@/data/pokedex.json";
import {
  searchPokemon,
  normalizeSearch,
  TYPES,
  TYPE_LABELS,
  type CatalogEntry,
  type Pokemon,
} from "@/lib/model";
import { createEgg, fromCatalog } from "@/lib/pokemon";
import { PokemonImage } from "./pokemon-image";
import { Modal } from "./ui";
import type { SpriteStyle, SpriteVariant } from "@/lib/sprite-options";

const egg = createEgg();
export function PokemonPicker({
  open,
  onClose,
  onSelect,
  spriteStyle,
  spriteVariant,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (p: Pokemon) => void;
  spriteStyle?: SpriteStyle;
  spriteVariant?: SpriteVariant;
}) {
  const { t: tr, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState(60);
  const results = useMemo(
    () => searchPokemon(catalog as CatalogEntry[], query, type, localizedSpecies[locale]),
    [query, type, locale],
  );
  const eggQuery = normalizeSearch(query.replace(/œ/gi, "oe"));
  const showEgg = type === "all" &&
    (!eggQuery || ["oeuf", "oeufs", "egg", "eggs", "huevo", "huevos", "ei", "eier", "タマゴ", "たまご", "卵"] .some((name) => normalizeSearch(name).includes(eggQuery)));
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={tr("Ajouter un Pokémon")}
      wide
    >
      <div className="picker-filters">
        <div className="search-field">
          <Search size={18} />
          <input
            autoFocus
            aria-label={tr("Rechercher un Pokémon")}
            placeholder={tr("Nom français, anglais ou numéro…")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(60);
            }}
          />
        </div>
        <Select
          aria-label={tr("Filtrer par type")}
          value={type}
          onValueChange={(value) => {
            setType(value);
            setLimit(60);
          }}
        >
          <SelectOption value="all">{tr("Tous les types")}</SelectOption>
          {TYPES.map((t) => (
            <SelectOption value={t} key={t}>
              {tr(TYPE_LABELS[t])}
            </SelectOption>
          ))}
        </Select>
      </div>
      <div className="picker-results-label">{results.length + Number(showEgg)} {tr(" résultat")}{results.length + Number(showEgg) !== 1 ? "s" : ""}</div>
      <div className="picker-grid">
        {showEgg && (
          <button
            type="button"
            className="picker-card picker-egg"
            aria-label={tr("Ajouter un œuf")}
            onClick={() => {
              onSelect(createEgg());
              onClose();
            }}
          >
            <PokemonImage pokemon={egg} style={spriteStyle} variant={spriteVariant} size={100} />
            <strong>{tr("Œuf")}</strong>
          </button>
        )}
        {results.slice(0, limit).map((entry) => (
          <button
            key={entry.id}
            className="picker-card"
            onClick={() => {
              onSelect(fromCatalog(entry));
              onClose();
            }}
          >
            <span>#{String(entry.id).padStart(3, "0")}</span>
            <PokemonImage
              pokemon={{ pokemonId: entry.id, name: entry.name, shiny: false }}
              style={spriteStyle}
              variant={spriteVariant}
              fallbackStyle="home"
              size={100}
            />
            <strong>{speciesName(entry.id, locale, entry.en)}</strong>
            <div className="type-pills">
              {entry.types.map((t) => (
                <span
                  key={t}
                  className={`type-dot type-${t}`}
                  aria-label={tr(TYPE_LABELS[t])}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
      {!results.length && !showEgg && (
        <div className="empty-state">
          <Search size={26} />
          <p>{tr("Aucun Pokémon trouvé.")}</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setType("all");
            }}
          >
            {tr("Effacer les filtres")}</button>
        </div>
      )}
      {results.length > limit && (
        <button
          className="button secondary load-more"
          onClick={() => setLimit((v) => v + 60)}
        >
          {tr("Afficher plus")}</button>
      )}
    </Modal>
  );
}
