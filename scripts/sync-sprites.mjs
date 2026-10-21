import { readFile, writeFile } from "node:fs/promises";
const api = "https://api.github.com/repos/PokeAPI/sprites/git/trees/";
const headers = { "User-Agent": "PokeStream sprite catalog" };
async function json(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(url + ": " + r.status);
  return r.json();
}
const cached = process.argv[2];
let paths;
if (cached) paths = JSON.parse(await readFile(cached, "utf8"));
else {
  const root = await json(api + "master");
  const sprites = await json(root.tree.find((t) => t.path === "sprites").url);
  const pokemon = await json(
    sprites.tree.find((t) => t.path === "pokemon").url,
  );
  paths = pokemon.tree.filter((t) => t.type === "blob").map((t) => t.path);
  for (const dir of pokemon.tree.filter((t) => t.type === "tree")) {
    const tree = await json(dir.url + "?recursive=1");
    if (tree.truncated) throw new Error("Incomplete tree: " + dir.path);
    paths.push(
      ...tree.tree
        .filter((t) => t.type === "blob")
        .map((t) => dir.path + "/" + t.path),
    );
  }
}
const sources = JSON.parse(
  await readFile("src/data/sprite-sources.json", "utf8"),
);
const manifest = {};
for (const source of sources) {
  const directories = {};
  for (const path of paths) {
    const prefix = source.path ? source.path + "/" : "";
    if (!path.startsWith(prefix)) continue;
    const relative = path.slice(prefix.length);
    const match = relative.match(/^(.*?)\/?(\d+)\.(png|gif|svg)$/);
    if (!match || match[3] !== source.extension) continue;
    const dir = match[1].replace(/\/$/, "");
    if (
      dir
        .split("/")
        .some(
          (v) =>
            v &&
            !["back", "female", "shiny", "transparent", "gray", "gbc"].includes(
              v,
            ),
        )
    )
      continue;
    (directories[dir] ||= []).push(Number(match[2]));
  }
  const ranges = {};
  for (const [dir, ids] of Object.entries(directories)) {
    const list = [...new Set(ids)].sort((a, b) => a - b);
    const packed = [];
    for (const id of list) {
      const last = packed.at(-1);
      if (last && id === last[1] + 1) last[1] = id;
      else packed.push([id, id]);
    }
    ranges[dir] = packed;
  }
  if (!ranges[""]?.length)
    throw new Error("No default sprites for " + source.id);
  manifest[source.id] = ranges;
}
await writeFile(
  "src/data/sprite-availability.json",
  JSON.stringify(manifest) + "\n",
);
function csv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const keys = rows.shift();
  return rows
    .filter((r) => r.length === keys.length)
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}
const csvRoot =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const tables = await Promise.all(
  ["items.csv", "item_names.csv"].map(async (file) => {
    const r = await fetch(csvRoot + file);
    if (!r.ok) throw new Error(file);
    return csv(await r.text());
  }),
);
const spriteTree = await json(api + "master");
const sprites = await json(
  spriteTree.tree.find((t) => t.path === "sprites").url,
);
const itemTree = await json(sprites.tree.find((t) => t.path === "items").url);
const itemPaths = new Set(
  itemTree.tree.filter((t) => t.type === "blob").map((t) => t.path),
);
const [items, names] = tables;
const localized = new Map(
  names
    .filter((n) => n.local_language_id === "5")
    .map((n) => [n.item_id, n.name]),
);
const english = new Map(
  names
    .filter((n) => n.local_language_id === "9")
    .map((n) => [n.item_id, n.name]),
);
const catalog = items
  .filter((i) => itemPaths.has(i.identifier + ".png"))
  .map((i) => ({
    slug: i.identifier,
    name: localized.get(i.id) || english.get(i.id) || i.identifier,
    en: english.get(i.id) || i.identifier,
  }));
await writeFile("src/data/items.json", JSON.stringify(catalog) + "\n");
console.log(
  Object.keys(manifest).length +
    " sources; " +
    catalog.length +
    " item sprites; " +
    JSON.stringify(manifest).length +
    " bytes of availability.",
);
