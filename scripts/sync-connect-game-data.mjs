import fs from "node:fs";
const root = process.cwd();
const commit = "6bbd96bb8ef7356963b833074ca25672d23e41c4";
const headers = { "User-Agent": "PokeStream Connect catalog" };
async function get(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(url + ": " + response.status);
  return response;
}
const files = ["items", "item_game_indices", "pokemon", "pokemon_forms", "pokemon_form_generations", "pokemon_types", "types", "version_groups"];
const tables = Object.fromEntries(await Promise.all(files.map(async name => [name, await (await get(
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/" + commit + "/data/v2/csv/" + name + ".csv"
)).text()])));
function csv(name) {
  const [header, ...rows] = tables[name].trim().split(/\r?\n/).map(line => line.split(","));
  return rows.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]])));
}
// An optional cached list can be shared with scripts/sync-sprites.mjs.
let paths;
if (process.argv[2]) paths = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
else {
  const tree = async url => (await get(url)).json();
  const rootTree = await tree("https://api.github.com/repos/PokeAPI/sprites/git/trees/master");
  const sprites = await tree(rootTree.tree.find(t => t.path === "sprites").url);
  const pokemon = await tree(sprites.tree.find(t => t.path === "pokemon").url);
  paths = pokemon.tree.filter(t => t.type === "blob").map(t => t.path);
  for (const dir of pokemon.tree.filter(t => t.type === "tree")) {
    const subtree = await tree(dir.url + "?recursive=1");
    if (subtree.truncated) throw new Error("Incomplete sprite tree: " + dir.path);
    paths.push(...subtree.tree.filter(t => t.type === "blob").map(t => dir.path + "/" + t.path));
  }
}

const items=new Map(csv('items').map(i=>[i.id,i.identifier])),localItems=new Map(JSON.parse(fs.readFileSync(root+'/src/data/items.json','utf8')).map(i=>[i.slug,i]));const held={};for(const row of csv('item_game_indices'))if([2,3,4,5,6,7,8,9].includes(+row.generation_id)){const slug=items.get(row.item_id);if(slug&&localItems.has(slug))(held[row.generation_id]||={})[row.game_index]=slug;}
const pokemon=new Map(csv('pokemon').map(p=>[p.id,p])),forms=new Map(csv('pokemon_forms').map(p=>[p.id,p]));const types=new Map(csv('types').map(t=>[t.id,t.identifier]));const monTypes={};for(const t of csv('pokemon_types'))(monTypes[t.pokemon_id]||=[]).push(types.get(t.type_id));const formMap={};
for(const row of csv('pokemon_form_generations')) {const gen=+row.generation_id;if(gen<4||gen>7)continue;const f=forms.get(row.pokemon_form_id),p=pokemon.get(f.pokemon_id);if(+p.species_id>(gen===4?493:gen===5?649:gen===6?721:807))continue;
// PokeAPI game indices are incomplete for Gen VI. Form order is the PKHeX
// FormConverter order for these generations, except Gen IV Arceus's ??? slot.
let index=+f.form_order-1;if(+p.species_id===493&&gen===4){if(f.form_identifier==='unknown')index=9;else if(index>=9)index++;}
// Pikachu's cosplay indices are replaced by cap forms in SM/USUM.
if(gen===7 && +p.species_id===25) {
  const caps=['','original-cap','hoenn-cap','sinnoh-cap','unova-cap','kalos-cap','alola-cap','partner-cap'];
  index=caps.indexOf(f.form_identifier);if(index<0)continue;
}
if(index>31)continue;const key=gen+':'+p.species_id+':'+index;const formSprite=+p.id===+p.species_id && f.form_identifier?p.species_id+'-'+f.form_identifier:undefined;
const data={pokemonId:+p.id,apiName:p.identifier,types:monTypes[p.id]};
if(gen===7 && +p.species_id===773 && [...types.values()].includes(f.form_identifier))data.types=[f.form_identifier];if(formSprite&&paths.some(s=>s.endsWith('/'+formSprite+'.png')||s===formSprite+'.png'||s.endsWith('/'+formSprite+'.gif')))data.formSprite=formSprite;
if(formMap[key]&&JSON.stringify(formMap[key])!==JSON.stringify(data))throw Error('Ambiguous form '+key);formMap[key]=data;
}
// Modern games use stored form indices, not PokeAPI pokemon IDs. Exclude
// G-Max (a battle state) and retired forms rather than assigning their reused
// PokeAPI form_order to a normal Pokémon. Reference: PKHeX FormConverter.
const groups=new Map(csv('version_groups').map(g=>[g.id,g]));
const caps=['','original-cap','hoenn-cap','sinnoh-cap','unova-cap','kalos-cap','alola-cap','partner-cap','starter','world-cap'];
for(const gen of [2,3,8,9])for(const f of forms.values()) {
  const p=pokemon.get(f.pokemon_id),species=+p.species_id,g=groups.get(f.introduced_in_version_group_id);
  if(!g || +g.generation_id>gen || ['legends-za','mega-dimension','champions'].includes(g.identifier))continue;
  if(species>(gen===2?251:gen===3?386:gen===8?905:1025))continue;
  const name=f.form_identifier;
  if(/mega|gmax|primal|totem/.test(name)||name==='unknown'||species===800&&name==='ultra')continue;
  let index=+f.form_order-1;
  if(gen>=8&&species===25){index=caps.indexOf(name);if(index<0)continue;}
  // Decoration is a separate PK8/PK9 field. The nine cream forms retain the
  // default decoration until that optional cosmetic field is supported.
  if(species===869&&!name.endsWith('strawberry-sweet'))continue;
  if(index<0||index>31)continue;
  const data={pokemonId:+p.id,apiName:p.identifier,types:monTypes[p.id]};
  if([493,773].includes(species)&&[...types.values()].includes(name))data.types=[name];
  const sprite=+p.id===species&&name?species+'-'+name:undefined;
  if(sprite&&paths.some(s=>s.endsWith('/'+sprite+'.png')||s===sprite+'.png'||s.endsWith('/'+sprite+'.gif')))data.formSprite=sprite;
  const key=gen+':'+species+':'+index;
  if(formMap[key]&&JSON.stringify(formMap[key])!==JSON.stringify(data))throw Error('Ambiguous modern form '+key);
  formMap[key]=data;
}

// Arceus's type belongs to its form, not its species-level default type list.
for(const [key,value]of Object.entries(formMap))if(key.split(':')[1]==='493'&&value.formSprite){const type=value.formSprite.slice(4);if(type!=="unknown" && type!=="shadow" && [...types.values()].includes(type))value.types=[type];}
fs.writeFileSync(root+'/src/data/connect-game-data.json',JSON.stringify({items:held,forms:formMap})+'\n');
const sources=JSON.parse(fs.readFileSync(root+'/src/data/sprite-sources.json','utf8')),sprites={};for(const sprite of new Set(Object.values(formMap).map(f=>f.formSprite).filter(Boolean)))for(const source of sources){const prefix=source.path?source.path+'/':'';for(const file of paths){if(!file.startsWith(prefix)||!file.endsWith('/'+sprite+'.'+source.extension)&&file!==sprite+'.'+source.extension)continue;const dir=file.slice(prefix.length,-(sprite.length+source.extension.length+1)).replace(/\/$/,'');if(dir.split('/').some(p=>p&&!['back','female','shiny','transparent','gray','gbc'].includes(p)))continue;((sprites[sprite]||={})[source.id]||=[]).push(dir)}}
fs.writeFileSync(root+'/src/data/connect-form-sprites.json',JSON.stringify(sprites)+'\n');
console.log('Imported game data:',Object.keys(formMap).length,'forms;',Object.values(held).reduce((n,a)=>n+Object.keys(a).length,0),'item mappings;',Object.keys(sprites).length,'form sprite sets');
