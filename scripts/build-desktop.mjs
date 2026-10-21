#!/usr/bin/env node
// Windows production build: Next standalone + local Connect engine + Electron resources.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {prepareLauncher} from "./prepare-launcher.mjs";
const root=process.cwd();
const webOnly=process.argv.includes("--web-only");
const output=path.join(root,".artifacts","runtime");
const fail=message=>{console.error("\n[PokeStream] "+message);process.exit(1);};
const run=(program,args,options={})=>{
 console.log("\n> "+program+" "+args.join(" "));
 const r=spawnSync(program,args,{cwd:root,stdio:"inherit",shell:process.platform==="win32"&&program==="npm",...options});
 if(r.error || r.status!==0)fail(r.error?.message||`${program} a échoué (code ${r.status}).`);
};
if(process.platform!=="win32"&&!webOnly)fail("La compilation du moteur Connect WPF nécessite Windows. Utilise Windows, ou --web-only pour préparer uniquement le frontend.");
if(!fs.existsSync(path.join(root,"node_modules","next")))fail("Dépendances absentes : exécute npm ci d'abord.");
if(!webOnly){
 const sprites=path.join(root,"desktop","connect","data","sprites.zip");
 if(!fs.existsSync(sprites)){
  console.log("[PokeStream] Le pack de sprites Connect est absent des archives sources : préparation nécessaire.");
  run("node",["scripts/prepare-connect-sprites.mjs"]);
 }
 if(!fs.existsSync(sprites))fail("Le pack de sprites n'a pas été généré.");
 run("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File","desktop/connect/publish.ps1","-SkipTests"]);
 const exe=path.join(root,"desktop","connect","dist","win-x64","PokeStream Connect.exe");
 if(!fs.existsSync(exe))fail("Le moteur PokeStream Connect.exe est introuvable après compilation.");
}
run("node",["scripts/prepare-sprite-catalog.mjs"]);
run("npm",["run","build"],{env:{...process.env,POKESTREAM_LOCAL:"1",NODE_ENV:"production"}});
const standalone=path.join(root,".next","standalone");
if(!fs.existsSync(path.join(standalone,"server.js")))fail("Next.js n'a pas créé .next/standalone/server.js.");
const workspace=path.resolve(root,'.artifacts');
if(path.dirname(output)!==workspace)fail('Invalid build output directory.');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
const dest=path.join(output,"web");fs.cpSync(standalone,dest,{recursive:true});
fs.mkdirSync(path.join(dest,".next"),{recursive:true});
fs.cpSync(path.join(root,".next","static"),path.join(dest,".next","static"),{recursive:true});
if(fs.existsSync(path.join(root,"public")))fs.cpSync(path.join(root,"public"),path.join(dest,"public"),{recursive:true,filter:p=>!p.split(path.sep).includes("downloads")});
// Ship Connect\x27s proven base sprites to keep standard teams visible when fully offline.
if(!webOnly){
 const pack=path.join(root,"desktop/connect/data/sprites.zip");
 const spriteDir=path.join(dest,"public","sprites");fs.mkdirSync(spriteDir,{recursive:true});
 // Use the module-free extractor: Windows PowerShell's Archive module may be unavailable.
 run("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File","desktop/app/runtime-install.ps1","-ArchivePath",pack,"-TargetDirectory",spriteDir]);
 if(!fs.existsSync(path.join(spriteDir,"pokemon","25.png")))fail("Base sprite pack missing from staged offline runtime.");
}
const catalog=path.join(root,".artifacts/sprite-catalog/manifest.json.gz");
if(!fs.existsSync(catalog))fail("Complete PokéAPI sprite catalog index missing.");
fs.mkdirSync(path.join(dest,"public","sprites"),{recursive:true});
fs.copyFileSync(catalog,path.join(dest,"public","sprites","manifest.json.gz"));
fs.cpSync(path.join(root,".artifacts/sprite-catalog/previews"),path.join(dest,"public","sprites"),{recursive:true});
// Badge artwork is required by the editor and OBS, including offline installations.
function badgeFiles(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?badgeFiles(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const badgeRoot=path.join(root,'public','Badges'),badges=badgeFiles(badgeRoot).filter(file=>file.endsWith('.png'));
if(!badges.length)fail('Badge artwork missing from public/Badges.');
for(const source of badges){const target=path.join(dest,'public','Badges',path.relative(badgeRoot,source));if(!fs.existsSync(target)||fs.statSync(target).size!==fs.statSync(source).size)fail('Badge missing from runtime: '+path.relative(badgeRoot,source));}
console.log('[PokeStream] '+badges.length+' badge images included.');
// The source ZIP intentionally does not contain compiled .NET binaries.
if(!webOnly)fs.cpSync(path.join(root,"desktop","connect","dist","win-x64"),path.join(output,"engine"),{recursive:true});
// Verify the actual staged payload, not the source checkout's node_modules.
const load=createRequire(path.join(dest,'server.js'));
for(const dependency of ['next','react','react-dom'])if(!load.resolve(dependency).startsWith(dest+path.sep))fail('Staged dependency missing: '+dependency);
prepareLauncher(root);
const shell=path.join(root,'.artifacts/shell');fs.mkdirSync(shell,{recursive:true});
for(const name of ['main.cjs','preload.cjs','runtime.cjs','installation.cjs','updater.cjs','maintenance.cjs'])fs.copyFileSync(path.join(root,'desktop/app',name),path.join(shell,name));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
fs.writeFileSync(path.join(shell,'package.json'),JSON.stringify({name:manifest.name,version:manifest.version,description:manifest.description,author:manifest.author,license:manifest.license,main:'main.cjs'}));
if(!webOnly){
 for(const file of ['LICENSE','OPEN-SOURCE-NOTICES.md'])fs.copyFileSync(path.join(root,file),path.join(output,file));
 fs.copyFileSync(path.join(root,'desktop/connect/THIRD-PARTY-NOTICES.md'),path.join(output,'CONNECT-NOTICES.md'));
 const archive=path.join(root,'.artifacts/runtime.zip');fs.rmSync(archive,{force:true});
 const source=output.replace(/'/g,"''"),target=archive.replace(/'/g,"''");
 run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('"+source+"','"+target+"',[System.IO.Compression.CompressionLevel]::Optimal,$false)"]);
 const hash=createHash('sha256');
 for await(const chunk of fs.createReadStream(archive))hash.update(chunk);
 fs.writeFileSync(path.join(root,'.artifacts/runtime.json'),JSON.stringify({version:manifest.version,size:fs.statSync(archive).size,sha256:hash.digest('hex')}));
}
console.log('\n[PokeStream] Runtime prepared: '+output);
if(webOnly)console.log("[PokeStream] Frontend seulement : impossible de distribuer l'application complète sans Connect.");
else {
 const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});if(git.status!==0)fail('Unable to record source commit.');
 fs.mkdirSync(path.join(root,'.artifacts/release'),{recursive:true});
 fs.writeFileSync(path.join(root,'.artifacts/release/build-info.json'),JSON.stringify({version:manifest.version,commit:git.stdout.trim(),builtAt:new Date().toISOString()},null,2));
 console.log('[PokeStream] Build metadata recorded; launcher ready for packaging.');
}
