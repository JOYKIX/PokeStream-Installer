import dex from "@/data/pokedex.json";
import gameNames from "@/data/localized-game-names.json";
import type { Locale } from "./config";
import type { Pokemon } from "@/lib/model";
import { translator } from "./catalog";
const names = new Map(dex.map((entry) => [entry.id, entry]));
export const localizedSpecies = gameNames.pokemon as Partial<Record<Locale, Record<string, string>>>;
export const localizedForms = gameNames.forms as Partial<Record<Locale, Record<string, string>>>;
export function speciesName(id: number, locale: Locale, fallback = "") {
  const species = names.get(id);
  return localizedSpecies[locale]?.[String(id)] || (locale === "fr" ? species?.name : species?.en) || fallback;
}
// Nicknames and eggs must never expose the hidden species or change the saved team.
export function pokemonName(pokemon: Pick<Pokemon, "speciesId" | "name" | "nickname" | "isEgg">, locale: Locale) {
  if (pokemon.isEgg) return translator(locale)("Œuf");
  return pokemon.nickname || speciesName(pokemon.speciesId, locale, pokemon.name);
}
