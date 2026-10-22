import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{decode,BASE,REPOSITORY}=require('../desktop/app/update-format.cjs');
const root=process.cwd(),dir=path.join(root,'.artifacts/release'),pkg=JSON.parse(fs.readFileSync('package.json','utf8')),version=pkg.version,tag='v'+version,updateOnly=process.argv.includes('--update-only');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git('remote','get-url','origin')!=='https://github.com/'+REPOSITORY+'.git')throw Error('Unexpected Git remote.');
if(git('status','--porcelain'))throw Error('Commit all source changes before publishing.');
const commit=git('rev-parse','HEAD');if(git('ls-remote','origin','refs/heads/main').split(/\s/)[0]!==commit)throw Error('Push the compiled commit to main first.');
const info=JSON.parse(fs.readFileSync(path.join(dir,'build-info.json'),'utf8')),manifest=decode(fs.readFileSync(path.join(dir,'update.json.gz')),fs.readFileSync(path.join(dir,'update.sig'),'utf8')),build=JSON.parse(fs.readFileSync(path.join(dir,'update-build.json'),'utf8'));
if(info.commit!==commit||manifest.commit!==commit||build.commit!==commit||[info.version,manifest.version,build.version].some(v=>v!==version)||info.launcherVersion!==pkg.launcherVersion)throw Error('Rebuild the exact committed source before publication.');
const input='protocol=https\nhost=github.com\n\n',credential=Object.fromEntries(execFileSync('git',['credential','fill'],{input,encoding:'utf8'}).trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
if(!credential.password)throw Error('GitHub authentication unavailable.');
const headers={Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','User-Agent':'PokeStream-Publisher','X-GitHub-Api-Version':'2026-03-10'};
const api='https://api.github.com/repos/'+REPOSITORY;
function request(url,{method='GET',body,file}={}){
 return new Promise((resolve,reject)=>{
  const parsed=new URL(url);if(parsed.protocol!=='https:'||!['api.github.com','uploads.github.com'].includes(parsed.hostname))return reject(Error('Unexpected publisher endpoint.'));
  const data=body===undefined?null:Buffer.from(JSON.stringify(body)),length=file?fs.statSync(file).size:data?.length;
  const req=https.request(parsed,{method,headers:{...headers,...(length!==undefined?{'Content-Length':length,'Content-Type':file?'application/octet-stream':'application/json'}:{})}},res=>{
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024)res.destroy(Error('GitHub response too large.'));else chunks.push(chunk);});res.on('error',reject);
   res.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');if(res.statusCode<200||res.statusCode>=300){const error=Error('GitHub HTTP '+res.statusCode);error.status=res.statusCode;return reject(error);}try{resolve(text?JSON.parse(text):null);}catch(e){reject(e);}});
  });req.on('error',reject);req.setTimeout(15*60000,()=>req.destroy(Error('GitHub publish timeout.')));
  if(file)fs.createReadStream(file).on('error',e=>req.destroy(e)).pipe(req);else req.end(data);
 });
}
async function listAssets(id){const all=[];for(let page=1;page<=50;page++){const batch=await request(api+'/releases/'+id+'/assets?per_page=100&page='+page);all.push(...batch);if(batch.length<100)return all;}throw Error('Distribution asset limit exceeded.');}
async function digest(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function upload(release,file,name=path.basename(file)){
 const url=release.upload_url.split('{')[0]+'?name='+encodeURIComponent(name);console.log('Uploading '+name+' ('+fs.statSync(file).size.toLocaleString('en')+' bytes)');
 const result=await request(url,{method:'POST',file});
 if(result.size!==fs.statSync(file).size||result.digest&&result.digest!=='sha256:'+await digest(file))throw Error('Uploaded asset verification failed: '+name);return result;
}
let release=null,published=false;
try{
 try{await request(api+'/releases/tags/'+tag);throw Error('Release already exists. Increment the version.');}catch(e){if(e.status!==404)throw e;}
 let distribution;
 try{distribution=await request(api+'/releases/tags/components-v1');}
 catch(e){if(e.status!==404)throw e;distribution=await request(api+'/releases',{method:'POST',body:{tag_name:'components-v1',target_commitish:commit,name:'PokeStream component storage',body:'Verified content blocks used by the PokeStream launcher. Assets still referenced by supported installers are retained.',draft:false,prerelease:true,make_latest:'false'}});}
 const assets=await listAssets(distribution.id);
 for(const name of build.bundles){
  const expected=manifest.bundles[name],existing=assets.find(a=>a.name===name);
  if(existing){if(existing.size!==expected.size||existing.digest&&existing.digest!=='sha256:'+expected.sha256)throw Error('Immutable component asset mismatch.');continue;}
  const file=path.join(dir,name);if(!fs.existsSync(file)||await digest(file)!==expected.sha256)throw Error('Required distribution bundle missing: '+name);
  assets.push(await upload(distribution,file));
 }
 // Store the exact corresponding native reader source once; every release links it.
 const legalRoot=path.join(root,'.artifacts/connect-sources'),sourceMeta=JSON.parse(fs.readFileSync(path.join(legalRoot,'SOURCE.json'),'utf8')),sourceName=sourceMeta.file;
 if(sourceMeta.revision!==info.components?.engine?.revision)throw Error('Reader source archive does not match the compiled engine.');
 if(!sourceName)throw Error('Corresponding SaveReader source archive is missing.');
 const source=path.join(legalRoot,sourceName),sourceHash=await digest(source),legalName='SaveReader-source-'+sourceHash+'.zip';
 if(!assets.some(a=>a.name===legalName))assets.push(await upload(distribution,source,legalName));
 const sourceRecord={name:legalName,sha256:sourceHash,size:fs.statSync(source).size,url:BASE+legalName};
 fs.writeFileSync(path.join(dir,'SOURCE.json'),JSON.stringify(sourceRecord,null,2)+'\n');
 const files=['update.json.gz','update.sig','build-info.json','SOURCE.json'].map(n=>path.join(dir,n));
 if(!updateOnly){
  const binary=path.join(dir,'PokeStream-'+version+'-win-x64.exe');if(!fs.existsSync(binary))throw Error('Build the launcher installer first.');
  const bootstrap=JSON.parse(fs.readFileSync(path.join(dir,'bootstrap.json'),'utf8'));
  if(bootstrap.version!==version||bootstrap.launcherVersion!==pkg.launcherVersion||bootstrap.desktopRevision!==manifest.components.desktop.revision||bootstrap.size!==fs.statSync(binary).size||bootstrap.sha256!==await digest(binary))throw Error('The bootstrap installer does not match the current launcher. Repackage it first.');
  const setup=path.join(dir,'PokeStream-Setup.exe');fs.copyFileSync(binary,setup);files.push(binary,setup);
 }
 const sums=path.join(dir,'SHA256SUMS.txt'),lines=[];for(const file of files)lines.push(await digest(file)+'  '+path.basename(file));fs.writeFileSync(sums,lines.join('\n')+'\n');files.push(sums);
 const notes=fs.readFileSync('RELEASE-NOTES.md','utf8')+'\n\n[SaveReader corresponding source]('+sourceRecord.url+')';
 release=await request(api+'/releases',{method:'POST',body:{tag_name:tag,target_commitish:commit,name:'PokeStream '+version,body:notes,draft:true,prerelease:false}});
 for(const file of files)await upload(release,file);
 release=await request(api+'/releases/'+release.id,{method:'PATCH',body:{draft:false,make_latest:updateOnly?'false':'true'}});published=true;
 console.log('Published '+release.html_url+(updateOnly?' (component update; existing bootstrap retained)':''));
 if(!process.argv.includes('--keep-old-releases')){
  const releases=await request(api+'/releases?per_page=100');
  // A current bootstrap is retained so earlier launchers can migrate to the modular updater.
  const bootstrap=releases.filter(r=>!r.draft&&!r.prerelease&&r.assets?.some(a=>a.name==='PokeStream-Setup.exe')).sort((a,b)=>b.tag_name.localeCompare(a.tag_name,'en',{numeric:true}))[0];
  for(const old of releases)if(old.id!==release.id&&old.id!==bootstrap?.id&&!old.draft&&/^v\d+\.\d+\.\d+$/.test(old.tag_name)&&old.tag_name.localeCompare(tag,'en',{numeric:true})<0){
   await request(api+'/releases/'+old.id,{method:'DELETE'});
   try{await request(api+'/git/refs/tags/'+encodeURIComponent(old.tag_name),{method:'DELETE'});}catch(e){if(e.status!==404)throw e;}
   console.log('Removed obsolete release '+old.tag_name);
  }
  // Preserve in-flight downloads and every block required by a retained bootstrap.
  // Immutable bundles are deleted only when unreferenced and at least a week old.
  const retained=(await request(api+'/releases?per_page=100')).filter(r=>!r.draft&&!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name));
  const referenced=new Set();let readable=true;
  const publicBytes=(await import('../desktop/app/update-network.cjs')).default.bytes;
  for(const item of retained){
   const find=name=>item.assets?.find(a=>a.name===name)?.browser_download_url;
   if(!find('update.json.gz'))continue;
   try{
    const [m,s]=await Promise.all([publicBytes(find('update.json.gz'),16*1024*1024),publicBytes(find('update.sig'),512)]);
    const current=decode(m.data,s.data.toString());for(const name of Object.keys(current.bundles))referenced.add(name);
    if(find('SOURCE.json')){const source=JSON.parse((await publicBytes(find('SOURCE.json'),65536)).data);if(/^SaveReader-source-[a-f0-9]{64}\.zip$/.test(source.name))referenced.add(source.name);}
   }catch{readable=false;break;}
  }
  if(readable)for(const asset of await listAssets(distribution.id)){
   if(!/^(content-[a-f0-9]{64}\.bin|SaveReader-source-[a-f0-9]{64}\.zip)$/.test(asset.name)||referenced.has(asset.name)||Date.now()-Date.parse(asset.created_at)<7*86400000)continue;
   await request(api+'/releases/assets/'+asset.id,{method:'DELETE'});console.log('Removed unused distribution content '+asset.name);
  }
 }
}catch(error){if(release&&!published)try{await request(api+'/releases/'+release.id,{method:'DELETE'});}catch{}throw error;}
finally{delete credential.password;delete headers.Authorization;}
