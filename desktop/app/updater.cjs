const {decode,REPOSITORY}=require('./update-format.cjs'),{bytes}=require('./update-network.cjs'),{createModular}=require('./modular-update.cjs');
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
    const endpoint=options.version?'https://api.github.com/repos/'+REPOSITORY+'/releases/tags/v'+options.version:'https://api.github.com/repos/'+REPOSITORY+'/releases?per_page=20';
    const data=JSON.parse((await bytes(endpoint,2*1024*1024)).data);
    const candidates=(Array.isArray(data)?data:[data]).filter(r=>!r.draft&&!r.prerelease&&validVersion(String(r.tag_name).replace(/^v/,''))).sort((a,b)=>b.tag_name.slice(1).localeCompare(a.tag_name.slice(1),'en',{numeric:true}));
    const remote=candidates.find(r=>r.assets?.some(a=>a.name==='update.json.gz')&&r.assets?.some(a=>a.name==='update.sig'));
    if(!remote)throw Error('No authenticated PokeStream update is available.');
    const url=name=>remote.assets.find(a=>a.name===name).browser_download_url;
    const [content,signature]=await Promise.all([bytes(url('update.json.gz'),16*1024*1024),bytes(url('update.sig'),512)]);
    const manifest=decode(content.data,signature.data.toString('utf8'));
    if('v'+manifest.version!==remote.tag_name||options.version&&manifest.version!==options.version)throw Error('Update version mismatch.');
    const current=app.getVersion();
    if(newer(current,manifest.version)&&!options.version)throw Error('The update server returned an older version.');
    const item={version:manifest.version,launcherVersion:manifest.launcherVersion,updateLauncher:newer(manifest.launcherVersion,launcherVersion),notes:{version:manifest.version,date:String(remote.published_at||'').slice(0,10),body:String(remote.body||'').slice(0,16000)}};
    release={...item,content:content.data,signature:signature.data.toString('utf8')};
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
