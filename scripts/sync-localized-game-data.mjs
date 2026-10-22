// Localized names from PokeAPI. UI and OBS never need a translation service.
import fs from "node:fs/promises";
const revision = "6bbd96bb8ef7356963b833074ca25672d23e41c4";
const languages = { ja: "11", es: "7", de: "6", en: "9", fr: "5", "pt-BR":"13", it:"8", ko:"3", "zh-CN":"12", "zh-TW":"4" };
function csv(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (char === "," || char === "\n")) { row.push(value.replace(/\r$/, "")); value = ""; if (char === "\n") { rows.push(row); row = []; } }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift();
  return rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((key, i) => [key, row[i]])));
}
const files = ["pokemon_species_names", "items", "item_names", "pokemon_forms", "pokemon_form_names"];
const tables = Object.fromEntries(await Promise.all(files.map(async name => {
  const response = await fetch(`https://raw.githubusercontent.com/PokeAPI/pokeapi/${revision}/data/v2/csv/${name}.csv`);
  if (!response.ok) throw new Error(`PokeAPI ${name}: ${response.status}`);
  return [name, csv(await response.text())];
})));
const output = { pokemon: {}, items: {}, forms: {} };
const itemSlugs = new Map(tables.items.map(row => [row.id, row.identifier]));
const formPokemon = new Map(tables.pokemon_forms.filter(row => row.is_default === "1").map(row => [row.id, row.pokemon_id]));
for (const [lang, id] of Object.entries(languages)) {
  output.pokemon[lang] = Object.fromEntries(tables.pokemon_species_names.filter(row => row.local_language_id === id).map(row => [row.pokemon_species_id, row.name]));
  output.items[lang] = Object.fromEntries(tables.item_names.filter(row => row.local_language_id === id && itemSlugs.has(row.item_id)).map(row => [itemSlugs.get(row.item_id), row.name]));
  output.forms[lang] = Object.fromEntries(tables.pokemon_form_names.filter(row => row.local_language_id === id && formPokemon.has(row.pokemon_form_id) && (row.form_name || row.pokemon_name)).map(row => [formPokemon.get(row.pokemon_form_id), row.form_name || row.pokemon_name]));
}
await fs.writeFile("src/data/localized-game-names.json", JSON.stringify(output) + "\n");
console.log("Downloaded localized species, items and forms from PokeAPI.");