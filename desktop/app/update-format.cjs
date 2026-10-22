const {verify,createHash}=require('node:crypto');
const {gunzipSync}=require('node:zlib');
const key=require('./update-key.json');
const REPOSITORY='JOYKIX/PokeStream-Installer',BASE='https://github.com/'+REPOSITORY+'/releases/download/components-v1/';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const version=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value);
function safePath(value){
 return typeof value==='string'&&value.length>0&&value.length<500&&!value.includes('\\')&&value.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[<>:"|?*\x00-\x1f]/.test(p)&&!/[. ]$/.test(p)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p));
}
function validate(manifest){
 if(manifest?.schema!==1||!version(manifest.version)||!version(manifest.launcherVersion)||!/^[a-f0-9]{40}$/.test(manifest.commit)||!manifest.components||!manifest.blocks||!manifest.bundles)throw Error('Invalid component manifest.');
 if(Object.keys(manifest.bundles).length>2000||Object.keys(manifest.blocks).length>200000)throw Error('Update manifest is too large.');
 for(const [name,b] of Object.entries(manifest.bundles))if(!/^content-[a-f0-9]{64}\.bin$/.test(name)||!Number.isSafeInteger(b.size)||b.size<1||b.size>2000000000||!/^[a-f0-9]{64}$/.test(b.sha256)||name!=='content-'+b.sha256+'.bin')throw Error('Invalid content bundle.');
 for(const [hash,b] of Object.entries(manifest.blocks)){
  if(!/^[a-f0-9]{64}$/.test(hash)||!Array.isArray(b)||b.length!==4||!manifest.bundles[b[0]]||!b.slice(1).every(Number.isSafeInteger)||b[1]<0||b[2]<1||b[2]>2*1024*1024||b[3]<1||b[3]>1024*1024||b[1]+b[2]>manifest.bundles[b[0]].size)throw Error('Invalid content block.');
 }
 let count=0,total=0;
 if(Object.keys(manifest.components).sort().join(',')!=='desktop,engine,web')throw Error('Unknown update component.');
 for(const component of Object.values(manifest.components)){
  if(!Array.isArray(component.files)||!/^[a-f0-9]{64}$/.test(component.revision))throw Error('Invalid component.');
  const names=new Set();
  for(const file of component.files){
   if(++count>100000||!Array.isArray(file)||file.length!==4||!safePath(file[0])||names.has(file[0].toLowerCase())||!Number.isSafeInteger(file[1])||file[1]<0||file[1]>2000000000||!/^[a-f0-9]{64}$/.test(file[2])||!Array.isArray(file[3]))throw Error('Invalid component file.');
   names.add(file[0].toLowerCase());let length=0;
   for(const hash of file[3]){const block=manifest.blocks[hash];if(!block)throw Error('Missing block.');length+=block[3];}
   if(length!==file[1])throw Error('Invalid file length.');
   total+=file[1];if(total>8*1024*1024*1024)throw Error('Update is too large.');
  }
  if(sha(Buffer.from(JSON.stringify(component.files)))!==component.revision)throw Error('Component manifest hash mismatch.');
 }
 for(const [component,name] of [['desktop','PokeStream.exe'],['desktop','resources/app.asar'],['desktop','resources/launcher/launcher.html'],['web','server.js'],['web','.next/BUILD_ID'],['engine','PokeStream Connect.exe']])if(!manifest.components[component].files.some(f=>f[0]===name))throw Error('Incomplete '+component+' component.');
 return manifest;
}
function decode(bytes,signature){
 if(bytes.length>16*1024*1024||typeof signature!=='string'||signature.length>200||!verify(null,bytes,key.publicKey,Buffer.from(signature.trim(),'base64')))throw Error('Update signature rejected.');
 return validate(JSON.parse(gunzipSync(bytes,{maxOutputLength:64*1024*1024}).toString('utf8')));
}
module.exports={sha,decode,validate,safePath,BASE,REPOSITORY};
