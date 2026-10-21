const https=require('node:https');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Transform}=require('node:stream');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function digest(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
const {pipeline}=require('node:stream/promises');
const RELEASE='https://api.github.com/repos/JOYKIX/PokeStream-Installer/releases/latest';
const MAX_SIZE=1500*1024*1024;
function releaseNotes(data){return {version:String(data.tag_name||'').replace(/^v/,''),date:String(data.published_at||'').slice(0,10),body:String(data.body||'').slice(0,16000)};}
function approved(value){const u=new URL(value);if(u.protocol!=='https:'||!['api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(u.hostname))throw Error('Update download address rejected.');return u;}
function request(url,redirects=5){return new Promise((resolve,reject)=>{
 if(redirects<0)return reject(Error('Too many redirects.'));
 let u;try{u=approved(url);}catch(e){return reject(e);}
 const req=https.get(u,{headers:{'User-Agent':'PokeStream-Launcher','Accept':'application/vnd.github+json'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){res.resume();try{resolve(request(new URL(res.headers.location,u).href,redirects-1));}catch(e){reject(e);}return;}
  if(res.statusCode!==200){res.resume();return reject(Error('GitHub HTTP '+res.statusCode));}resolve(res);
 });req.setTimeout(30000,()=>req.destroy(Error('Update server unavailable.')));req.on('error',reject);
});}
async function retryRequest(url){let error;for(let attempt=0;attempt<3;attempt++){try{return await request(url);}catch(e){error=e;if(/HTTP (400|401|403|404)/.test(e.message))break;if(attempt<2)await delay(1000*(attempt+1));}}throw error;}
async function bytes(url,max){const response=await retryRequest(url);let size=0,chunks=[];for await(const chunk of response){size+=chunk.length;if(size>max){response.destroy();throw Error('Update response too large.');}chunks.push(chunk);}return Buffer.concat(chunks);}
function newer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;}
function createUpdater({app,directory,notify,launcherVersion='0.0.0'}){
 let release=null,downloaded=null,checking=null,downloading=null;
 const record=path.join(directory,'download.json');
 async function cached(item){
  if(!item||!/^\d+\.\d+\.\d+$/.test(item.version)||!(newer(item.version,app.getVersion())||(typeof item.launcherVersion==='string'&&/^\d+\.\d+\.\d+$/.test(item.launcherVersion)&&newer(item.launcherVersion,launcherVersion)))||!Number.isSafeInteger(item.size)||item.size<1||item.size>MAX_SIZE||!/^[a-f0-9]{64}$/.test(item.sha256))return null;
  const file=path.join(directory,'PokeStream-'+item.version+'.exe');
  try{if((await fsp.stat(file)).size===item.size&&await digest(file)===item.sha256)return {...item,path:file};}catch{}return null;
 }
 async function restore(){try{return await cached(JSON.parse(await fsp.readFile(record,'utf8')));}catch{return null;}}
 async function ready(item){downloaded=item;notify({status:'ready',version:item.version,progress:100,error:'',notes:item.notes||null});return {status:'ready',version:item.version};}
 async function check(){
  if(downloading)return {status:'downloading',version:release?.version};
  if(downloaded){if(newer(downloaded.version,app.getVersion())||downloaded.updateLauncher){notify({status:'ready',version:downloaded.version,error:'',notes:downloaded.notes||null});return {status:'ready',version:downloaded.version};}downloaded=null;}
  if(checking)return checking;
  checking=(async()=>{
   notify({status:'checking',error:''});
   const saved=await restore();
   if(!app.isPackaged){const info={status:'development',version:app.getVersion()};notify(info);return info;}
   try{
    const data=JSON.parse((await bytes(RELEASE,1024*1024)).toString('utf8'));
    const version=String(data.tag_name||'').replace(/^v/,'');
    if(data.draft||data.prerelease||!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release.');
    // From 2.2 onwards the setup executable IS the custom launcher, not a native NSIS wizard.
    const asset=data.assets?.find(a=>a.name==='PokeStream-'+version+'-win-x64.exe');
    const sums=data.assets?.find(a=>a.name==='SHA256SUMS.txt');
    if(!asset||!sums||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>MAX_SIZE)throw Error('Release files missing.');
    const checksum=(await bytes(sums.browser_download_url,128*1024)).toString('utf8').split(/\r?\n/).map(l=>l.match(/^([a-f\d]{64})\s+\*?(.+)$/i)).find(m=>m&&m[2]===asset.name)?.[1]?.toLowerCase();
    if(!checksum)throw Error('Update checksum missing.');
    let remoteLauncher='0.0.0';
    const metadata=data.assets?.find(a=>a.name==='build-info.json');
    if(metadata){const info=JSON.parse((await bytes(metadata.browser_download_url,65536)).toString('utf8'));if(info.version!==version)throw Error('Invalid release metadata.');if(info.launcherVersion!=null){if(!/^\d+\.\d+\.\d+$/.test(info.launcherVersion))throw Error('Invalid launcher version.');remoteLauncher=info.launcherVersion;}}
    release={version,url:approved(asset.browser_download_url).href,size:asset.size,sha256:checksum,notes:releaseNotes(data),launcherVersion:remoteLauncher,updateLauncher:newer(remoteLauncher,launcherVersion)};
    const existing=await cached(release);if(existing)return ready(existing);
    const info={status:newer(version,app.getVersion())||release.updateLauncher?'available':'current',version,progress:null,error:'',notes:release.notes};notify(info);return info;
   }catch(error){if(saved)return ready(saved);notify({status:'offline',progress:null,error:error.message});return {status:'offline',version:app.getVersion()};}
  })().finally(()=>checking=null);return checking;
 }
 async function download(){
  if(downloading)return downloading;
  if(!release)await check();
  if(!release||!(newer(release.version,app.getVersion())||release.updateLauncher))throw Error('No update available.');
  const item={...release};
  downloading=(async()=>{
   await fsp.mkdir(directory,{recursive:true});const target=path.join(directory,'PokeStream-'+item.version+'.exe'),temp=target+'.partial';
   notify({status:'downloading',version:item.version,progress:0,error:''});
   try{
    let size=0,last=-1;const hash=createHash('sha256'),res=await retryRequest(item.url);
    const verify=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;if(size>item.size)return callback(Error('Invalid update size.'));hash.update(chunk);
     const progress=Math.floor(100*size/item.size);if(progress!==last){last=progress;notify({progress,received:size,total:item.size});}callback(null,chunk);}});
    await pipeline(res,verify,fs.createWriteStream(temp,{flags:'w'}));
    if(size!==item.size||hash.digest('hex')!==item.sha256)throw Error('Update checksum mismatch.');
    await fsp.rename(temp,target);const metadata=record+'.tmp';await fsp.writeFile(metadata,JSON.stringify(item));await fsp.rename(metadata,record);return ready({...item,path:target});
   }catch(error){if(/HTTP 404/.test(error.message))release=null;await fsp.rm(temp,{force:true}).catch(()=>{});notify({status:'available',progress:null,error:error.message});throw error;}
  })().finally(()=>downloading=null);return downloading;
 }
 return {check,download,reset:()=>{release=null;downloaded=null;},getDownloaded:()=>downloaded,verify:async()=>{const item=await cached(downloaded);if(!item){downloaded=null;notify({status:'available',error:'Update files changed. Download the update again.'});throw Error('Update files changed. Download the update again.');}return item;}};
}
module.exports={createUpdater};
