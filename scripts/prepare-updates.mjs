import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {filesAt} from './component-cache.mjs';
import {signRelease} from './release-signing.mjs';
const require=createRequire(import.meta.url),{decode,validate,sha,REPOSITORY}=require('../desktop/app/update-format.cjs'),{bytes}=require('../desktop/app/update-network.cjs');
const root=process.cwd(),release=path.join(root,'.artifacts/release'),cache=path.join(root,'.artifacts/update-base');fs.mkdirSync(release,{recursive:true});fs.mkdirSync(cache,{recursive:true});
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
let base=null;
try{
 const {data}=await bytes('https://api.github.com/repos/'+REPOSITORY+'/releases?per_page=20',2*1024*1024);
 const releases=JSON.parse(data).filter(r=>!r.draft&&!r.prerelease&&r.assets?.some(a=>a.name==='update.json.gz')).sort((a,b)=>b.tag_name.slice(1).localeCompare(a.tag_name.slice(1),'en',{numeric:true}));
 for(const r of releases.slice(0,3))try{
  const find=name=>r.assets.find(a=>a.name===name)?.browser_download_url;
  const [m,s]=await Promise.all([bytes(find('update.json.gz'),16*1024*1024),bytes(find('update.sig'),512)]);
  const parsed=decode(m.data,s.data.toString());if('v'+parsed.version!==r.tag_name)throw Error('Release version mismatch.');
  base=parsed;fs.writeFileSync(path.join(cache,'manifest.gz'),m.data);fs.writeFileSync(path.join(cache,'signature'),s.data);break;
 }catch(e){console.warn('[PokeStream] Baseline rejected: '+e.message);}
}catch(e){console.warn('[PokeStream] Remote baseline unavailable: '+e.message);}
if(!base)try{base=decode(fs.readFileSync(path.join(cache,'manifest.gz')),fs.readFileSync(path.join(cache,'signature'),'utf8'));}catch{}
const roots={desktop:path.join(release,'win-unpacked'),web:path.join(root,'.artifacts/runtime/web'),engine:path.join(root,'.artifacts/runtime/engine')};
const blocks={},bundles={},components={},pending=path.join(release,'content.pending'),fd=fs.openSync(pending,'w');let offset=0;
try{
 for(const [name,directory] of Object.entries(roots)){
  const files=[];
  for(const absolute of filesAt(directory)){
   const relative=path.relative(directory,absolute).split(path.sep).join('/');
   // The initial installer retains its recovery archive. Installed components don't duplicate it.
   if(name==='desktop'&&['resources/runtime.zip','resources/runtime.json'].includes(relative))continue;
   const stream=fs.openSync(absolute,'r'),hash=createHash('sha256'),chunks=[];let size=0;
   try{
    while(true){
     const buffer=Buffer.allocUnsafe(1024*1024),length=fs.readSync(stream,buffer,0,buffer.length,null);if(!length)break;
     const chunk=buffer.subarray(0,length),id=sha(chunk);hash.update(chunk);size+=length;chunks.push(id);
     if(blocks[id])continue;
     if(base?.blocks[id]){blocks[id]=base.blocks[id];bundles[blocks[id][0]]=base.bundles[blocks[id][0]];}
     else {const compressed=gzipSync(chunk,{level:6});fs.writeSync(fd,compressed);blocks[id]=['pending',offset,compressed.length,length];offset+=compressed.length;}
    }
   }finally{fs.closeSync(stream);}
   files.push([relative,size,hash.digest('hex'),chunks]);
  }
  components[name]={revision:sha(Buffer.from(JSON.stringify(files))),files};
 }
}finally{fs.closeSync(fd);}
let created=null;
if(offset){
 const digest=createHash('sha256');for await(const chunk of fs.createReadStream(pending))digest.update(chunk);
 const hash=digest.digest('hex'),name='content-'+hash+'.bin';created=name;fs.renameSync(pending,path.join(release,name));
 bundles[name]={size:offset,sha256:hash};for(const block of Object.values(blocks))if(block[0]==='pending')block[0]=name;
}else fs.rmSync(pending,{force:true});
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest=validate({schema:1,version:pkg.version,launcherVersion:pkg.launcherVersion,commit,createdAt:new Date().toISOString(),components,blocks,bundles});
const compressed=gzipSync(Buffer.from(JSON.stringify(manifest)),{level:9});
fs.writeFileSync(path.join(release,'update.json.gz'),compressed);fs.writeFileSync(path.join(release,'update.sig'),signRelease(compressed)+'\n');
fs.writeFileSync(path.join(release,'update-build.json'),JSON.stringify({version:pkg.version,commit,created,bundles:Object.keys(bundles),baseline:base?.version??null,newBytes:offset},null,2));
console.log('[PokeStream] Modular payload: '+offset.toLocaleString('en')+' new compressed bytes; '+(base?.version??'initial')+' baseline.');

const installer=path.join(release,'PokeStream-'+pkg.version+'-win-x64.exe'),bootstrapFile=path.join(release,'bootstrap.json');
if(fs.existsSync(installer)){
 const hash=createHash('sha256');for await(const chunk of fs.createReadStream(installer))hash.update(chunk);
 const digest=hash.digest('hex'),info=JSON.parse(fs.readFileSync(path.join(release,'build-info.json'),'utf8'));let previous;
 try{previous=JSON.parse(fs.readFileSync(bootstrapFile,'utf8'));}catch{}
 if(fs.statSync(installer).mtimeMs>=Date.parse(info.builtAt)||previous?.desktopRevision===components.desktop.revision&&previous.sha256===digest)
  fs.writeFileSync(bootstrapFile,JSON.stringify({version:pkg.version,launcherVersion:pkg.launcherVersion,desktopRevision:components.desktop.revision,size:fs.statSync(installer).size,sha256:digest}));
}
