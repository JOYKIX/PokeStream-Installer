import { mkdir, writeFile } from "node:fs/promises";
// One build-time snapshot avoids over 1,000 API calls in every visitor's browser.
const root =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const files = [
  "pokemon_species_names.csv",
  "pokemon_species.csv",
  "pokemon_types.csv",
  "types.csv",
];
const tables = await Promise.all(
  files.map(async (name) => {
    const response = await fetch(root + name);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const lines = (await response.text()).trim().split(/\r?\n/);
    const headers = lines.shift().split(",");
    return lines.map((line) =>
      Object.fromEntries(line.split(",").map((v, i) => [headers[i], v])),
    );
  }),
);
const [names, species, pokemonTypes, types] = tables;
const typeMap = Object.fromEntries(types.map((t) => [t.id, t.identifier]));
const catalog = species
  .map((p) => ({
    id: Number(p.id),
    slug: p.identifier,
    name:
      names.find(
        (n) => n.pokemon_species_id === p.id && n.local_language_id === "5",
      )?.name || p.identifier,
    en:
      names.find(
        (n) => n.pokemon_species_id === p.id && n.local_language_id === "9",
      )?.name || p.identifier,
    types: pokemonTypes
      .filter((t) => t.pokemon_id === p.id)
      .map((t) => typeMap[t.type_id]),
  }))
  .filter((p) => p.types.length > 0);
await mkdir("src/data", { recursive: true });
await writeFile("src/data/pokedex.json", JSON.stringify(catalog));
console.log(`Saved ${catalog.length} Pokémon, French and English names.`);
