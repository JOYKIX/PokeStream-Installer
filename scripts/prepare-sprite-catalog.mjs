#!/usr/bin/env node
// Reuse pinned metadata for ordinary builds. Refresh it explicitly, not on every patch.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const stage=path.resolve('.artifacts/sprite-catalog'),file=path.join(stage,'catalog-v2.json.gz');
await fs.mkdir(stage,{recursive:true});
if(process.argv.includes('--refresh')||!await fs.stat(file).catch(()=>null)){
 const result=spawnSync(process.execPath,['scripts/prepare-sprite-packs.mjs'],{stdio:'inherit',env:process.env});if(result.status!==0)throw Error('Sprite metadata generation failed.');
}
const catalog=JSON.parse(gunzipSync(await fs.readFile(file)));
const sources=JSON.parse(await fs.readFile('src/data/sprite-sources.json','utf8')),entries=catalog.files.map(f=>f[0]),available={},forms={};
const dirs=new Set(['','back','female','shiny','transparent','gray','gbc']);
for(const source of sources){
 const prefix='pokemon/'+(source.path?source.path+'/':''),variants=new Map();
 for(const file of entries){
  if(!file.startsWith(prefix)||!file.endsWith('.'+source.extension))continue;
  const relative=file.slice(prefix.length),last=relative.lastIndexOf('/'),directory=last<0?'':relative.slice(0,last),stem=relative.slice(last+1,-(source.extension.length+1));
  if(directory.split('/').some(part=>!dirs.has(part)))continue;
  if(/^\d+$/.test(stem)){if(!variants.has(directory))variants.set(directory,[]);variants.get(directory).push(Number(stem));}
  else if(/^\d+-[a-z0-9-]+$/.test(stem)){const map=forms[stem]??={},list=map[source.id]??=[];if(!list.includes(directory))list.push(directory);}
 }
 const map={};for(const [directory,values] of variants){const ranges=[];for(const number of [...new Set(values)].sort((a,b)=>a-b)){const previous=ranges.at(-1);if(previous&&number===previous[1]+1)previous[1]=number;else ranges.push([number,number]);}map[directory]=ranges;}available[source.id]=map;
}
for(const [name,value] of [['sprite-availability.json',available],['connect-form-sprites.json',forms]]){
 const data=JSON.stringify(value)+'\n',target=path.join('src/data',name);
 if(await fs.readFile(target,'utf8')!==data)await fs.writeFile(target,data);
}
await fs.writeFile(path.join(stage,'manifest.json.gz'),gzipSync(JSON.stringify(entries),{level:9}));
const previews=catalog.files.filter(f=>/^pokemon\/(?:[^/]+\/)*25(?:-[a-z0-9-]+)?\.(png|gif|svg|webp)$/.test(f[0]));
let next=0;
const blob=data=>createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
async function worker(){while(next<previews.length){
 const [relative,size,hash]=previews[next++],target=path.join(stage,'previews',...relative.split('/'));
 try{const data=await fs.readFile(target);if(data.length===size&&blob(data)===hash)continue;}catch{}
 const response=await fetch('https://raw.githubusercontent.com/PokeAPI/sprites/'+catalog.commit+'/sprites/'+relative,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Pikachu preview unavailable: '+relative);
 const data=Buffer.from(await response.arrayBuffer());if(data.length!==size||blob(data)!==hash)throw Error('Pikachu preview integrity error.');
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data);
}}
await Promise.all(Array.from({length:6},worker));
const previewRoot=path.join(stage,'previews'),keep=new Set(previews.map(f=>f[0]));
async function prune(dir,relative=''){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const rel=relative?relative+'/'+entry.name:entry.name,target=path.join(dir,entry.name);if(entry.isDirectory())await prune(target,rel);else if(entry.isFile()&&!keep.has(rel))await fs.unlink(target);}}
await prune(previewRoot);
const license=path.join(stage,'LICENCE.txt');
if(!await fs.stat(license).catch(()=>null)){
 const response=await fetch('https://raw.githubusercontent.com/PokeAPI/sprites/'+catalog.commit+'/LICENCE.txt',{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Upstream image notices unavailable.');await fs.writeFile(license,await response.text());
}
console.log('[PokeStream] '+catalog.files.length+' indexed assets; '+previews.length+' verified, protected Pikachu previews. Catalog '+catalog.commit.slice(0,8)+'.');
