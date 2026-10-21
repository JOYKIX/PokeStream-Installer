#!/usr/bin/env node
// Reconstitute the missing sprite pack from PokeAPI at the exact pinned revision.
// Original PokeStream source exports excluded data/sprites.zip: these files are fetched only for local builds.
import {readFileSync,existsSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import path from "node:path";
const manifest=JSON.parse(readFileSync("desktop/connect/data/sprite-manifest.json","utf8"));
const root=path.resolve(".artifacts/connect-sprites");
const final=path.resolve("desktop/connect/data/sprites.zip");
if(existsSync(final)){console.log("Pack existant : "+final);process.exit(0);}
if(process.platform!=="win32") { console.error("Le pack de sprites doit être assemblé sous Windows (PowerShell). Le développement web reste accessible.");process.exit(1); }
mkdirSync(root,{recursive:true});
const base=`https://raw.githubusercontent.com/PokeAPI/sprites/${manifest.commit}/sprites/`;
let next=0,finished=0;
async function worker(){
 while(next<manifest.files.length){const file=manifest.files[next++];const dst=path.join(root,file.file);
  let valid=false;try{const {readFileSync}=await import("node:fs");valid=createHash("sha256").update(readFileSync(dst)).digest("hex")===file.sha256;}catch{}
  if(!valid){let last;for(let n=0;n<3;n++){try{const r=await fetch(base+file.file);if(!r.ok)throw Error(`${r.status}: ${file.file}`);const bytes=Buffer.from(await r.arrayBuffer());if(createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw Error("SHA256 incorrect pour "+file.file);mkdirSync(path.dirname(dst),{recursive:true});writeFileSync(dst,bytes);last=null;break;}catch(e){last=e;await new Promise(done=>setTimeout(done,500*(n+1)));}}
   if(last)throw last;
  }
  finished++;if(finished%250===0)console.log(`${finished}/${manifest.files.length} sprites vérifiés`);
 }
}
try{await Promise.all(Array.from({length:12},()=>worker()));}
catch(e){console.error("Échec sprites :",e.message);process.exit(1);}
const script=`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${root.replace(/'/g,"''")}','${final.replace(/'/g,"''")}',[System.IO.Compression.CompressionLevel]::Optimal,$false)`;
const r=spawnSync("powershell.exe",["-NoProfile","-Command",script],{stdio:"inherit"});
if(r.status!==0||!existsSync(final))process.exit(1);
console.log("Pack de sprites créé : "+final);
