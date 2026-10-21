import type { CatalogEntry, Pokemon } from "./model";

export { spriteCandidates } from "./sprites";
export function createEgg(): Pokemon {
  // Match Connect's egg representation; the species ID stays internal.
  return {
    speciesId: 1,
    pokemonId: 1,
    name: "Œuf",
    apiName: "egg",
    nickname: "",
    level: 1,
    shiny: false,
    gender: "unknown",
    fainted: false,
    item: "",
    types: ["normal"],
    isEgg: true,
  };
}
export function fromCatalog(p: CatalogEntry): Pokemon {
  return {
    speciesId: p.id,
    pokemonId: p.id,
    name: p.name,
    apiName: p.slug,
    nickname: "",
    level: 5,
    shiny: false,
    fainted: false,
    item: "",
    types: p.types as Pokemon["types"],
  };
}
export type PokemonForm = {
  id: number;
  name: string;
  label: string;
  labelEn?: string;
  types: Pokemon["types"];
};
