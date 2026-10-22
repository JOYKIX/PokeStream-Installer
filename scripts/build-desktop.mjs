#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {componentCache,fingerprint,sourceFiles,filesAt} from './component-cache.mjs';
import {prepareLauncher} from './prepare-launcher.mjs';
const root=process.cwd(),webOnly=process.argv.includes('--web-only'),updateOnly=process.argv.includes('--update-only'),launcherOnly=process.argv.includes('--launcher-only'),force=process.argv.includes('--force');
const artifacts=path.join(root,'.artifacts'),output=path.join(artifacts,'runtime'),cached=componentCache(root);
const manifest=JSON.parse(fs.readFileSync('package.json','utf8'));
function run(program,args,options={}){
 console.log('\n> '+program+' '+args.join(' '));
 const result=spawnSync(program,args,{cwd:root,stdio:'inherit',windowsHide:true,shell:process.platform==='win32'&&program==='npm',...options});
 if(result.error||result.status!==0)throw Error(result.error?.message||program+' failed ('+result.status+').');
}
if(process.platform!=='win32'&&!webOnly)throw Error('The Connect engine requires Windows.');
if(!fs.existsSync('node_modules/next'))throw Error('Run npm ci first.');
fs.mkdirSync(output,{recursive:true});
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));delete lock.version;if(lock.packages?.[''])delete lock.packages[''].version;
const toolchain=JSON.stringify({node:process.versions.node,lock});
const reports={};
if(!launcherOnly){
 if(!webOnly){
  if(!fs.existsSync('desktop/connect/data/sprites.zip'))run('node',['scripts/prepare-connect-sprites.mjs']);
  const engineInput=fingerprint(root,[...sourceFiles(root,'desktop/connect'),'desktop/connect/data/sprites.zip'],process.platform+'-'+process.arch+'-'+spawnSync('dotnet',['--version'],{encoding:'utf8'}).stdout.trim());
  reports.engine=await cached('engine',engineInput,async stage=>{
   run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','desktop/connect/publish.ps1','-SkipTests']);
   const source='desktop/connect/dist/win-x64';
   if(!fs.existsSync(path.join(source,'PokeStream Connect.exe')))throw Error('Connect publish is incomplete.');
   fs.cpSync(source,stage,{recursive:true});
   fs.copyFileSync('desktop/connect/THIRD-PARTY-NOTICES.md',path.join(stage,'CONNECT-NOTICES.md'));
   fs.cpSync('desktop/connect/licenses',path.join(stage,'licenses'),{recursive:true});
   fs.copyFileSync('desktop/connect/tools/SaveReader/LICENSE',path.join(stage,'SaveReader-LICENSE.txt'));
   const legal=path.join(artifacts,'connect-sources');fs.mkdirSync(legal,{recursive:true});
   const publishSource=fs.readFileSync('desktop/connect/publish.ps1','utf8'),nativeVersion=/\$version\s*=\s*'([^']+)'/.exec(publishSource)?.[1];if(!nativeVersion)throw Error('Reader version missing.');
   const name='PokeStream-SaveReader-'+nativeVersion+'-source.zip';fs.copyFileSync(path.join('desktop/connect/dist',name),path.join(legal,name));
   fs.writeFileSync(path.join(legal,'SOURCE.json'),JSON.stringify({file:name,revision:engineInput}));
  },{force:force||!fs.existsSync(path.join(artifacts,'connect-sources/SOURCE.json'))});
 }
 run('node',['scripts/prepare-sprite-catalog.mjs',...(process.argv.includes('--refresh-catalog')?['--refresh']:[])]);
 const webInput=fingerprint(root,[...sourceFiles(root,'src'),...sourceFiles(root,'public'),'next.config.ts','tsconfig.json','.artifacts/sprite-catalog/catalog-v2.json.gz','.artifacts/sprite-catalog/previews','desktop/connect/data/sprites.zip'],toolchain);
 reports.web=await cached('web',webInput,async stage=>{
  run('npm',['run','build'],{env:{...process.env,POKESTREAM_LOCAL:'1',POKESTREAM_BUILD_ID:webInput.slice(0,32),NODE_ENV:'production'}});
  const standalone=path.join(root,'.next/standalone');
  if(!fs.existsSync(path.join(standalone,'server.js')))throw Error('Next standalone build missing.');
  fs.cpSync(standalone,stage,{recursive:true});
  fs.cpSync(path.join(root,'.next/static'),path.join(stage,'.next/static'),{recursive:true});
  if(fs.existsSync('public'))fs.cpSync('public',path.join(stage,'public'),{recursive:true,filter:p=>!p.split(path.sep).includes('downloads')});
  const sprites=path.join(stage,'public/sprites');fs.mkdirSync(sprites,{recursive:true});
  if(!webOnly)run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','desktop/app/runtime-install.ps1','-ArchivePath',path.join(root,'desktop/connect/data/sprites.zip'),'-TargetDirectory',sprites]);
  for(const name of ['manifest.json.gz','catalog-v2.json.gz','LICENCE.txt'])fs.copyFileSync(path.join(artifacts,'sprite-catalog',name),path.join(sprites,name));
  fs.cpSync(path.join(artifacts,'sprite-catalog/previews'),sprites,{recursive:true});
  const catalog=JSON.parse(gunzipSync(fs.readFileSync(path.join(sprites,'catalog-v2.json.gz')))),indexed=new Map(catalog.files.map(f=>[f[0],f])),bundled={};
  for(const file of filesAt(sprites)){const relative=path.relative(sprites,file).split(path.sep).join('/'),entry=indexed.get(relative);if(!entry)continue;const data=fs.readFileSync(file),hash=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');if(hash===entry[2]&&data.length===entry[1])bundled[hash]=relative;}
  fs.writeFileSync(path.join(sprites,'bundled-index.json'),JSON.stringify(bundled));

  const load=createRequire(path.join(stage,'server.js'));for(const name of ['next','react','react-dom'])if(!load.resolve(name).startsWith(stage+path.sep))throw Error('Staged dependency missing: '+name);
 },{force});
 for(const name of ['web',...(!webOnly?['engine']:[])]){
  const target=path.join(output,name);
  if(path.dirname(target)!==output)throw Error('Invalid component staging path.');
  fs.rmSync(target,{recursive:true,force:true});fs.cpSync(reports[name].directory,target,{recursive:true});
 }
 for(const name of ['LICENSE','OPEN-SOURCE-NOTICES.md'])fs.copyFileSync(name,path.join(output,name));
 fs.copyFileSync('desktop/connect/THIRD-PARTY-NOTICES.md',path.join(output,'CONNECT-NOTICES.md'));
}
const launcherInput=fingerprint(root,[...sourceFiles(root,'desktop/app'),'public/logo/pokestream-logo-no-stand.svg','.artifacts/sprite-catalog/previews/pokemon/25.png','.artifacts/sprite-catalog/previews/pokemon/other/home/25.png'],toolchain);
reports.launcher=await cached('launcher',launcherInput,async stage=>prepareLauncher(root,stage),{force});
const launcherTarget=path.join(output,'launcher');fs.rmSync(launcherTarget,{recursive:true,force:true});fs.cpSync(reports.launcher.directory,launcherTarget,{recursive:true});
const shell=path.join(artifacts,'shell');fs.mkdirSync(shell,{recursive:true});
for(const name of fs.readdirSync('desktop/app').filter(n=>n.endsWith('.cjs')||n==='update-key.json'))fs.copyFileSync(path.join('desktop/app',name),path.join(shell,name));
fs.writeFileSync(path.join(shell,'package.json'),JSON.stringify({name:manifest.name,version:manifest.version,launcherVersion:manifest.launcherVersion,description:manifest.description,author:manifest.author,license:manifest.license,main:'main.cjs'}));
const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});if(git.status!==0)throw Error('Cannot record source commit.');
fs.mkdirSync(path.join(artifacts,'release'),{recursive:true});
fs.writeFileSync(path.join(artifacts,'release/build-info.json'),JSON.stringify({version:manifest.version,launcherVersion:manifest.launcherVersion,commit:git.stdout.trim(),builtAt:new Date().toISOString(),bootstrap:true,components:Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,{revision:v.revision,reused:v.reused}]))},null,2));
console.log('[PokeStream] Launcher contains no web build, Connect engine, sprite packs or runtime archive.');
if(updateOnly){
 run('node',['node_modules/electron-builder/out/cli/cli.js','--config','desktop/app/electron-builder.yml','--win','--dir','--publish','never']);
 run('node',['scripts/prepare-updates.mjs']);
}
