const https=require('node:https');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const RELEASE='https://api.github.com/repos/JOYKIX/PokeStream-Installer/releases/latest';
const MAX_SIZE=1500*1024*1024;
function approved(value){const u=new URL(value);if(u.protocol!=='https:'||!['api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(u.hostname))throw Error('Update download address rejected.');return u;}
function request(url,redirects=5){return new Promise((resolve,reject)=>{
 if(redirects<0)return reject(Error('Too many redirects.'));
 let u;try{u=approved(url);}catch(e){return reject(e);}
 const req=https.get(u,{headers:{'User-Agent':'PokeStream-Launcher','Accept':'application/vnd.github+json'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){res.resume();try{resolve(request(new URL(res.headers.location,u).href,redirects-1));}catch(e){reject(e);}return;}
  if(res.statusCode!==200){res.resume();return reject(Error('GitHub HTTP '+res.statusCode));}resolve(res);
 });req.setTimeout(30000,()=>req.destroy(Error('Update server unavailable.')));req.on('error',reject);
});}
async function bytes(url,max){const response=await request(url);let size=0,chunks=[];for await(const chunk of response){size+=chunk.length;if(size>max){response.destroy();throw Error('Update response too large.');}chunks.push(chunk);}return Buffer.concat(chunks);}
function newer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;}
function createUpdater({app,directory,notify}){
 let release=null,downloaded=null,checking=null,downloading=null;
 async function check(){
  if(downloading)return {status:'downloading',version:release?.version};
  if(downloaded)return {status:'ready',version:downloaded.version};
  if(checking)return checking;
  checking=(async()=>{
   notify({status:'checking',error:''});
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
    release={version,url:approved(asset.browser_download_url).href,size:asset.size,sha256:checksum};
    const info={status:newer(version,app.getVersion())?'available':'current',version};notify(info);return info;
   }catch(error){notify({status:'offline',error:error.message});return {status:'offline',version:app.getVersion()};}
  })().finally(()=>checking=null);return checking;
 }
 async function download(){
  if(downloading)return downloading;
  if(!release||!newer(release.version,app.getVersion()))throw Error('No update available.');
  const item={...release};
  downloading=(async()=>{
   await fsp.mkdir(directory,{recursive:true});const target=path.join(directory,'PokeStream-'+item.version+'.exe'),temp=target+'.partial';
   notify({status:'downloading',version:item.version,progress:0,error:''});
   try{
    let size=0,last=-1;const hash=createHash('sha256'),res=await request(item.url);
    const verify=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;if(size>item.size)return callback(Error('Invalid update size.'));hash.update(chunk);
     const progress=Math.floor(100*size/item.size);if(progress!==last){last=progress;notify({progress,received:size,total:item.size});}callback(null,chunk);}});
    await pipeline(res,verify,fs.createWriteStream(temp,{flags:'w'}));
    if(size!==item.size||hash.digest('hex')!==item.sha256)throw Error('Update checksum mismatch.');
    await fsp.rename(temp,target);downloaded={...item,path:target};notify({status:'ready',progress:100});return {status:'ready',version:item.version};
   }catch(error){await fsp.rm(temp,{force:true}).catch(()=>{});notify({status:'available',progress:null,error:error.message});throw error;}
  })().finally(()=>downloading=null);return downloading;
 }
 return {check,download,getDownloaded:()=>downloaded};
}
module.exports={createUpdater};
