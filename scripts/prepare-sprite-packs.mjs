#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {gzipSync} from "node:zlib";
import {buildSpriteCatalog} from "../src/local/sprite-catalog-source.mjs";
const target=path.resolve(".artifacts/sprite-catalog");await fs.mkdir(target,{recursive:true});
const catalog=await buildSpriteCatalog({progress:prefix=>console.log("[PokeStream] Sprite metadata: "+prefix)});
await fs.writeFile(path.join(target,"catalog-v2.json.gz"),gzipSync(JSON.stringify(catalog),{level:9}));
await fs.writeFile(path.join(target,"catalog-v2-summary.json"),JSON.stringify({commit:catalog.commit,packs:catalog.packs},null,2));
console.log("[PokeStream] "+catalog.files.length+" source files in "+catalog.packs.length+" modular packs.");
