// Authenticated, component-based installation. Only missing content blocks are fetched.
let fs;try{fs=require('original-fs');}catch{fs=require('node:fs');}
const fsp=fs.promises,path=require('node:path'),{randomUUID,createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
const {decode,sha,BASE}=require('./update-format.cjs'),{bytes}=require('./update-network.cjs');
const {acquireOperation}=require('./operation-lock.cjs');
const BLOCK=1024*1024;
async function hashFile(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function safeRoot(root){if((await fsp.lstat(root)).isSymbolicLink())throw Error('Installation contains an unexpected link.');return path.resolve(root);}
async function walk(root,relative=''){
 const result=[];
 for(const e of await fsp.readdir(path.join(root,relative),{withFileTypes:true})){
  if(e.isSymbolicLink())continue;
  const rel=relative?relative+'/'+e.name:e.name;
  if(e.isDirectory())result.push(...await walk(root,rel));
  else if(e.isFile()&&!['resources/runtime.zip','resources/runtime.json'].includes(rel))result.push(rel);
 }return result;
}
async function writeAll(handle,buffer){let written=0;while(written<buffer.length){const result=await handle.write(buffer,written,buffer.length-written);if(!result.bytesWritten)throw Error('Installation write stopped.');written+=result.bytesWritten;}}
async function atomic(file,data){await fsp.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await fsp.writeFile(temp,data);await fsp.rename(temp,file);}
function child(root,name,pattern){const target=path.resolve(root,name);if(!pattern.test(name)||path.dirname(target)!==path.resolve(root))throw Error('Invalid installation destination.');return target;}
async function removeTree(root,name,pattern){const target=child(root,name,pattern);try{await safeRoot(target);}catch(e){if(e.code==='ENOENT')return;throw e;}await fsp.rm(target,{recursive:true,force:true});}
function createModular({directory,installDir,launcherDir,roots,notify}){
 const cache=path.join(directory,'blocks'),record=path.join(directory,'modular.json');let working=null,downloaded=null;
 async function manifestFrom(item){const buffer=await fsp.readFile(item.manifest),signature=await fsp.readFile(item.signature,'utf8');const manifest=decode(buffer,signature);if(manifest.version!==item.version)throw Error('Update version mismatch.');return manifest;}
 async function plan(manifest){
  await fsp.mkdir(cache,{recursive:true});const local=new Map(),whole=new Map();let scanned=0;
  const directories=await roots();
  const scannedRoots=[];
  for(const root of [...new Set(Object.values(directories).filter(Boolean))]){
   if(scannedRoots.some(parent=>path.resolve(root).startsWith(parent+path.sep)))continue;
   try{await safeRoot(root);scannedRoots.push(path.resolve(root));}catch{continue;}
   for(const relative of await walk(root)){
    const file=path.join(root,...relative.split('/')),handle=await fsp.open(file,'r'),fileHash=createHash('sha256');let offset=0;
    try{while(true){const buffer=Buffer.allocUnsafe(BLOCK),{bytesRead}=await handle.read(buffer,0,BLOCK,offset);if(!bytesRead)break;const data=buffer.subarray(0,bytesRead),hash=sha(data);fileHash.update(data);if(manifest.blocks[hash])local.set(hash,{file,offset,size:bytesRead});offset+=bytesRead;}}
    finally{await handle.close();}
    whole.set(fileHash.digest('hex'),file);
    if(++scanned%200===0){notify({status:'downloading',step:'comparing',scanned,progress:null});await new Promise(r=>setImmediate(r));}
   }
  }
  const missing=[];
  for(const [hash,block] of Object.entries(manifest.blocks)){
   if(local.has(hash))continue;
   try{const data=await fsp.readFile(path.join(cache,hash));if(data.length===block[3]&&sha(data)===hash)continue;}catch{}
   missing.push(hash);
  }
  const requests=[];
  for(const name of Object.keys(manifest.bundles)){
   const entries=missing.filter(hash=>manifest.blocks[hash][0]===name).sort((a,b)=>manifest.blocks[a][1]-manifest.blocks[b][1]);let group=null;
   for(const hash of entries){const block=manifest.blocks[hash],end=block[1]+block[2]-1;
    if(!group||end-group.start>16*1024*1024||block[1]-group.end>65536){group={name,start:block[1],end,hashes:[hash]};requests.push(group);}
    else{group.end=end;group.hashes.push(hash);}
   }
  }
  return {local,whole,requests,total:requests.reduce((n,r)=>n+r.end-r.start+1,0)};
 }
 async function fetchBlocks(manifest,planned){
  let received=0,next=0;const full=new Map();
  async function fullBundle(name){
   if(!full.has(name))full.set(name,(async()=>{
    const expected=manifest.bundles[name],result=await bytes(BASE+name,expected.size);
    if(result.data.length!==expected.size||sha(result.data)!==expected.sha256)throw Error('Content bundle verification failed.');
    return result.data;
   })());return full.get(name);
  }
  async function worker(){while(next<planned.requests.length){
   const request=planned.requests[next++],length=request.end-request.start+1;let buffer;
   try{
    const result=await bytes(BASE+request.name,length,{headers:{Range:'bytes='+request.start+'-'+request.end},status:206});
    const expected='bytes '+request.start+'-'+request.end+'/'+manifest.bundles[request.name].size;
    if(result.headers['content-range']!==expected||result.data.length!==length)throw Error('Content range mismatch.');buffer=result.data;
   }catch(error){
    // Some download proxies don't support ranges. Verify the entire official bundle before use.
    notify({status:'downloading',step:'full-fallback',error:''});
    buffer=(await fullBundle(request.name)).subarray(request.start,request.end+1);
   }
   for(const hash of request.hashes){
    const block=manifest.blocks[hash],compressed=buffer.subarray(block[1]-request.start,block[1]-request.start+block[2]);
    const raw=gunzipSync(compressed,{maxOutputLength:BLOCK});if(raw.length!==block[3]||sha(raw)!==hash)throw Error('Update block verification failed.');
    await atomic(path.join(cache,hash),raw);
   }
   received+=length;notify({status:'downloading',step:'downloading',received,total:planned.total,progress:Math.floor(100*received/Math.max(1,planned.total)),error:''});
  }}
  const results=await Promise.allSettled(Array.from({length:4},worker));const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
 }
 async function stage(manifest,planned,includeLauncher){
  const id=randomUUID(),desktop='desktop-'+manifest.version+'-'+id,runtime='runtime-'+manifest.version+'-'+id,launcher='launcher-'+manifest.launcherVersion+'-'+id;
  const destinations={desktop:child(installDir,desktop,/^desktop-[\w.-]+$/),web:path.join(child(installDir,runtime,/^runtime-[\w.-]+$/),'web'),engine:path.join(installDir,runtime,'engine')};
  const allocated=[[installDir,desktop,/^desktop-[\w.-]+$/],[installDir,runtime,/^runtime-[\w.-]+$/]];
  if(includeLauncher)allocated.push([launcherDir,launcher,/^launcher-[\w.-]+$/]);
  for(const root of [installDir,launcherDir]){await fsp.mkdir(root,{recursive:true});await safeRoot(root);}
  try{
   const jobs=Object.entries(manifest.components).flatMap(([name,component])=>component.files.map(file=>({name,file})));let next=0,done=0;
   const worker=async()=>{while(next<jobs.length){
    const {name,file}=jobs[next++],target=path.join(destinations[name],...file[0].split('/'));await fsp.mkdir(path.dirname(target),{recursive:true});
    const original=planned.whole.get(file[2]);
    if(original){await fsp.copyFile(original,target);}
    else{
     const output=await fsp.open(target,'wx');
     try{for(const hash of file[3]){
      let raw;const existing=planned.local.get(hash);
      if(existing){const input=await fsp.open(existing.file,'r');try{raw=Buffer.allocUnsafe(existing.size);const r=await input.read(raw,0,raw.length,existing.offset);if(r.bytesRead!==raw.length)throw Error('Local update source changed.');}finally{await input.close();}}
      else raw=await fsp.readFile(path.join(cache,hash));
      if(sha(raw)!==hash)throw Error('Local update source changed.');await writeAll(output,raw);
     }}finally{await output.close();}
    }
    if((await fsp.stat(target)).size!==file[1]||await hashFile(target)!==file[2])throw Error('Installed file verification failed.');
    done++;if(done%100===0)notify({status:'downloading',step:'verifying',progress:Math.floor(100*done/jobs.length)});
   }};
   const results=await Promise.allSettled(Array.from({length:6},worker));const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;
   require('./runtime.cjs').validate(path.join(installDir,runtime));
   if(includeLauncher){
    const target=child(launcherDir,launcher,/^launcher-[\w.-]+$/);await fsp.cp(destinations.desktop,target,{recursive:true});
    await fsp.rename(path.join(target,'PokeStream.exe'),path.join(target,'PokeStream Launcher.exe'));
   }
   return {desktop,runtime,launcher:includeLauncher?launcher:null};
  }catch(e){for(const [root,name,pattern] of allocated)await removeTree(root,name,pattern).catch(()=>{});throw e;}
 }
 async function download(item,manifestBytes,signature){
  if(working)return working;
  working=(async()=>{
   const release=await acquireOperation(directory,{purpose:'prepare'});
   try{
   const manifestFile=path.join(directory,'update.json.gz'),signatureFile=path.join(directory,'update.sig');
   await atomic(manifestFile,manifestBytes);await atomic(signatureFile,signature);
   const manifest=decode(manifestBytes,signature),planned=await plan(manifest);
   const required=Object.values(manifest.components).reduce((n,c)=>n+c.files.reduce((sum,f)=>sum+f[1],0),0)+(item.updateLauncher?manifest.components.desktop.files.reduce((n,f)=>n+f[1],0):0)+planned.total;
   const disk=await fsp.statfs(directory);if(Number(disk.bavail)*Number(disk.bsize)<required)throw Error('Not enough free disk space to prepare the update.');
   notify({status:'downloading',step:'downloading',progress:0,total:planned.total,received:0,version:manifest.version});
   await fetchBlocks(manifest,planned);
   let prepared;
   try{prepared=await stage(manifest,planned,item.updateLauncher);}
   catch(error){
    // Re-scan when an installed file changed during preparation; no pointer has changed.
    const fresh=await plan(manifest);await fetchBlocks(manifest,fresh);prepared=await stage(manifest,fresh,item.updateLauncher);
   }
   downloaded={...item,kind:'modular',manifest:manifestFile,signature:signatureFile,...prepared};
   await atomic(record,JSON.stringify(downloaded));notify({status:'ready',step:'ready',version:item.version,progress:100,error:'',notes:item.notes||null});
   return downloaded;
   }finally{await release();}
  })().finally(()=>{working=null;});return working;
 }
 async function restore(){const release=await acquireOperation(directory,{purpose:'restore'});try{try{const value=JSON.parse(await fsp.readFile(record,'utf8'));await verifyPrepared(value);downloaded=value;return value;}catch{downloaded=null;await fsp.rm(record,{force:true});return null;}}finally{await release();}}
 async function verifyPrepared(item=downloaded){
  if(!item||item.kind!=='modular')throw Error('No prepared update.');const manifest=await manifestFrom(item);
  const locations={desktop:child(installDir,item.desktop,/^desktop-[\w.-]+$/),web:path.join(child(installDir,item.runtime,/^runtime-[\w.-]+$/),'web'),engine:path.join(installDir,item.runtime,'engine')};
  for(const [name,component] of Object.entries(manifest.components)){
   await safeRoot(locations[name]);
   for(const file of component.files){const absolute=path.join(locations[name],...file[0].split('/'));if((await fsp.lstat(absolute)).isSymbolicLink()||await hashFile(absolute)!==file[2])throw Error('Prepared update has changed.');}
  }
  if(item.launcher){
   const location=child(launcherDir,item.launcher,/^launcher-[\w.-]+$/);await safeRoot(location);
   for(const f of manifest.components.desktop.files){const name=f[0]==='PokeStream.exe'?'PokeStream Launcher.exe':f[0];if(await hashFile(path.join(location,...name.split('/')))!==f[2])throw Error('Prepared launcher has changed.');}
  }return {item,manifest};
 }
 async function commit(item=downloaded){
  const release=await acquireOperation(directory,{purpose:'commit'});
  try{
  const verified=await verifyPrepared(item),manifest=verified.manifest;
  const entries=[[installDir,'desktop.json',{version:manifest.version,directory:item.desktop}],[installDir,'runtime.json',{version:manifest.version,directory:item.runtime}]];
  if(item.launcher)entries.push([launcherDir,'launcher.json',{version:manifest.launcherVersion,directory:item.launcher}]);
  const journal=path.join(installDir,'install-transaction.json'),backups=[];
  for(const [root,name,value] of entries){let old=null;try{old=(await fsp.readFile(path.join(root,name))).toString('base64');}catch{}backups.push({area:root===installDir?'app':'launcher',name,old,value});}
  await atomic(journal,JSON.stringify({state:'pending',entries:backups}));
  try{
   for(const [root,name,value] of entries)await atomic(path.join(root,name),JSON.stringify(value));
   await atomic(path.join(installDir,'rollback.json'),JSON.stringify({version:manifest.version,entries:backups.filter(e=>e.area==='app')}));
   await atomic(journal,JSON.stringify({state:'committed',entries:backups}));
   await atomic(path.join(installDir,'components.json'),JSON.stringify(manifest));
   await fsp.rm(record,{force:true});await fsp.rm(journal,{force:true});downloaded=null;
   return {version:manifest.version,target:path.join(installDir,item.desktop,'PokeStream.exe'),launcherTarget:item.launcher?path.join(launcherDir,item.launcher,'PokeStream Launcher.exe'):null};
  }catch(error){await recover(installDir,launcherDir);throw error;}
  }finally{await release();}
 }
 return {download,restore,verify:verifyPrepared,commit,manifestFrom};
}
async function recover(installDir,launcherDir){
 const file=path.join(installDir,'install-transaction.json');let data;try{data=JSON.parse(await fsp.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return;throw e;}
 if(!['pending','committed'].includes(data.state)||!Array.isArray(data.entries)||data.entries.length>3)throw Error('Invalid installation recovery record.');
 if(data.state==='pending')for(const entry of data.entries){
  if(!['app','launcher'].includes(entry.area)||!['desktop.json','runtime.json','launcher.json'].includes(entry.name))throw Error('Invalid installation recovery target.');
  const target=path.join(entry.area==='app'?installDir:launcherDir,entry.name);
  if(entry.old!==null)await atomic(target,Buffer.from(entry.old,'base64'));else await fsp.rm(target,{force:true});
 }
 await fsp.rm(file,{force:true});
}
async function cleanVersions({installDir,launcherDir,updatesDir,currentExecutable}){
 const release=updatesDir?await acquireOperation(updatesDir,{purpose:'cleanup'}):async()=>{};
 try{
 if(updatesDir){try{await fsp.access(path.join(updatesDir,'modular.json'));return;}catch{}}
 const live=new Set([path.dirname(currentExecutable)]);
 for(const [root,names] of [[installDir,['desktop.json','runtime.json']],[launcherDir,['launcher.json']]])for(const name of names)try{
  const item=JSON.parse(await fsp.readFile(path.join(root,name),'utf8'));
  if(/^(desktop|runtime|launcher)-[\w.-]+$/.test(item.directory))live.add(child(root,item.directory,/^(desktop|runtime|launcher)-[\w.-]+$/));
 }catch{}
 for(const root of [installDir,launcherDir]){
  try{await safeRoot(root);}catch{continue;}
  for(const entry of await fsp.readdir(root,{withFileTypes:true})){
   if(entry.isSymbolicLink()||!entry.isDirectory()||!/^(desktop|runtime|launcher)-\d+\.\d+\.\d+-[\w.-]+$/.test(entry.name))continue;
   const target=child(root,entry.name,/^(desktop|runtime|launcher)-[\w.-]+$/);
   if(!live.has(target))await removeTree(root,entry.name,/^(desktop|runtime|launcher)-[\w.-]+$/).catch(()=>{});
  }
 }
 await fsp.rm(path.join(installDir,'rollback.json'),{force:true});
 const legacySetup=path.join(installDir,'PokeStream.exe');if(path.resolve(currentExecutable)!==path.resolve(legacySetup))try{if((await fsp.lstat(legacySetup)).isFile())await fsp.unlink(legacySetup);}catch{}
 // Successful startup is the boundary: never delete profiles, sprites or shared configuration.
 if(updatesDir)for(const entry of await fsp.readdir(updatesDir,{withFileTypes:true}).catch(()=>[])){
  if(entry.isSymbolicLink())continue;
  if(entry.isFile()&&/^(PokeStream-\d+\.\d+\.\d+\.exe(?:\.partial)?|download\.json|modular\.json|update\.json\.gz|update\.sig)$/.test(entry.name))await fsp.unlink(path.join(updatesDir,entry.name)).catch(()=>{});
  else if(entry.isDirectory()&&entry.name==='blocks')await removeTree(updatesDir,'blocks',/^blocks$/).catch(()=>{});
 }
 }finally{await release();}
}
async function rollbackUpdate({installDir,expectedVersion}){
 const file=path.join(installDir,'rollback.json');let data;try{data=JSON.parse(await fsp.readFile(file,'utf8'));}catch{return false;}
 if(data.version!==expectedVersion||!Array.isArray(data.entries)||data.entries.length!==2)return false;
 const backups=[];
 for(const entry of data.entries){
  if(entry.area!=='app'||!['desktop.json','runtime.json'].includes(entry.name)||typeof entry.old!=='string')return false;
  const previous=JSON.parse(Buffer.from(entry.old,'base64').toString()),current=JSON.parse(await fsp.readFile(path.join(installDir,entry.name),'utf8'));
  const prefix=entry.name==='desktop.json'?'desktop':'runtime';
  if(!/^\d+\.\d+\.\d+$/.test(previous.version)||!/^(desktop|runtime)-[\w.-]+$/.test(previous.directory)||!previous.directory.startsWith(prefix+'-')||current.directory!==entry.value.directory||current.version!==data.version)return false;
  await safeRoot(child(installDir,previous.directory,/^(desktop|runtime)-[\w.-]+$/));backups.push([entry.name,Buffer.from(entry.old,'base64')]);
 }
 await atomic(path.join(installDir,'install-transaction.json'),JSON.stringify({state:'pending',entries:data.entries}));
 for(const [name,contents] of backups)await atomic(path.join(installDir,name),contents);
 await fsp.rm(path.join(installDir,'install-transaction.json'),{force:true});
 await fsp.rm(file,{force:true});return true;
}
module.exports={createModular,recover,rollbackUpdate,cleanVersions,hashFile};
