const {readRelease}=require('./update-release.cjs'),{createModular}=require('./modular-update.cjs');
const validVersion=v=>/^\d+\.\d+\.\d+$/.test(v);
function newer(a,b){return a.localeCompare(b,'en',{numeric:true})>0;}
function createUpdater({app,directory,notify,launcherVersion='0.0.0',installDir,launcherDir,roots}){
 let release=null,downloaded=null,checking=null,downloading=null,restored=false;
 // A ready event is sent only after this coordinator owns the prepared package.
 const modular=createModular({directory,installDir,launcherDir,roots,notify:value=>{if(value.status!=='ready')notify(value);}});
 function ready(item){notify({status:'ready',step:'ready',updateLauncher:!!item.updateLauncher,version:item.version,notes:item.notes||null,progress:100,error:''});return {status:'ready',version:item.version};}
 async function check(options={}){
  if(downloading)return {status:'downloading',version:release?.version};
  if(checking){await checking.catch(()=>{});return check(options);}
  checking=(async()=>{
   notify({status:'checking',step:null,error:'',progress:null});
   if(!app.isPackaged){const value={status:'development',version:app.getVersion()};notify(value);return value;}
   if(!restored&&!options.repair&&!options.version){restored=true;const item=await modular.restore();if(item&&(newer(item.version,app.getVersion())||newer(item.launcherVersion,launcherVersion))){downloaded=item;return ready(item);}}
   try{
    if(options.version&&!validVersion(options.version))throw Error('Invalid requested version.');
    const {content,signature,manifest,notes}=await readRelease(options.version);
    const current=app.getVersion();
    if(newer(current,manifest.version)&&!options.version)throw Error('The update server returned an older version.');
    const item={version:manifest.version,launcherVersion:manifest.launcherVersion,updateLauncher:newer(manifest.launcherVersion,launcherVersion),notes};
    release={...item,content,signature};
    if(!options.repair&&downloaded?.version===item.version){try{await modular.verify(downloaded);return ready(downloaded);}catch{downloaded=null;}}
    const state={status:options.repair||newer(item.version,current)||item.updateLauncher?'available':'current',step:null,updateLauncher:item.updateLauncher,version:item.version,error:'',progress:null,notes:item.notes};notify(state);return state;
   }catch(error){notify({status:'offline',step:null,error:error.message,progress:null});throw error;}
  })().finally(()=>checking=null);return checking;
 }
 async function download(options={}){
  if(downloading)return downloading;
  if(checking)await checking;
  if(!release)await check(options);
  if(!release){if(downloaded)return downloaded;throw Error('No update available.');}
  const {content,signature,...item}=release;
  downloading=modular.download(item,content,signature).then(value=>{downloaded=value;ready(value);return value;}).catch(error=>{notify({status:'available',step:null,error:error.message,progress:null});throw error;}).finally(()=>downloading=null);
  return downloading;
 }
 function reset(){release=null;downloaded=null;restored=false;notify({status:'idle',updateLauncher:false,step:null,error:'',progress:null,notes:null});}
 async function ensurePrepared(){
  if(downloading)await downloading;
  let item=downloaded??await modular.restore();
  if(item&&!newer(app.getVersion(),item.version))try{await modular.verify(item);downloaded=item;return item;}catch{downloaded=null;}
  // The UI can outlive temporary files or a previous launcher process.
  await check({repair:true});await download();return downloaded;
 }
 return {check,download,reset,ensurePrepared,getDownloaded:()=>downloaded,
  verify:async()=>{const value=await modular.verify(downloaded);return value.item;},
  install:async()=>{const value=await modular.commit(downloaded);reset();return value;}};
}
module.exports={createUpdater};
