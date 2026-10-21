// Copy the raw Electron distribution, including app.asar as an opaque file.
const fs=require('original-fs'),fsp=fs.promises,path=require('node:path');
const {randomUUID}=require('node:crypto');
const samePath=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
function createInstallation({directory,version,notify,prefix='desktop',manifest='desktop.json',executableName='PokeStream.exe'}){
 const manifestPath=path.join(directory,manifest);
 function current(){try{
  const record=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(record.version!==version||!new RegExp('^'+prefix+'-[a-zA-Z0-9.-]+$').test(record.directory))return null;
  const root=path.join(directory,record.directory);
  for(const file of [executableName,'resources/app.asar','resources/launcher/launcher.html'])if(!fs.existsSync(path.join(root,file)))return null;
  return path.join(root,executableName);
 }catch{return null;}}
 async function install(source,{force=false,sourceExecutable='PokeStream.exe'}={}){
  const existing=current();if(existing&&!force)return existing;
  if(!fs.existsSync(path.join(source,'resources/app.asar'))||!fs.existsSync(path.join(source,sourceExecutable)))throw Error('The installation package is incomplete.');
  await fsp.mkdir(directory,{recursive:true});
  const name=prefix+'-'+version+'-'+randomUUID(),destination=path.join(directory,name);
  if(path.dirname(destination)!==path.resolve(directory)||samePath(source,destination))throw Error('Invalid installation directory.');
  const files=[];let total=0;
  async function scan(root,relative=''){
   for(const entry of await fsp.readdir(root,{withFileTypes:true})){
    const rel=path.join(relative,entry.name),absolute=path.join(root,entry.name);
    if(entry.isSymbolicLink())throw Error('Unexpected link in application package.');
    if(entry.isDirectory())await scan(absolute,rel);
    else if(entry.isFile()){const {size}=await fsp.stat(absolute);files.push({rel,absolute,size});total+=size;}
   }
  }
  await scan(source);notify({phase:'installing',progress:0});let next=0,copied=0;
  try{
   const workers=await Promise.allSettled(Array.from({length:4},async()=>{
    while(next<files.length){const file=files[next++],target=path.join(destination,file.rel);await fsp.mkdir(path.dirname(target),{recursive:true});await fsp.copyFile(file.absolute,target);copied+=file.size;notify({progress:Math.floor(100*copied/Math.max(total,1))});}
   }));
   const failure=workers.find(result=>result.status==='rejected');if(failure)throw failure.reason;
   if(sourceExecutable!==executableName)await fsp.rename(path.join(destination,sourceExecutable),path.join(destination,executableName));
   const temp=manifestPath+'.'+randomUUID();await fsp.writeFile(temp,JSON.stringify({version,directory:name}));await fsp.rename(temp,manifestPath);
   return path.join(destination,executableName);
  }catch(error){
   if(path.dirname(destination)===path.resolve(directory)&&path.basename(destination)===name)await fsp.rm(destination,{recursive:true,force:true}).catch(()=>{});
   throw error;
  }
 }
 return {current,install};
}
module.exports={createInstallation,samePath};
