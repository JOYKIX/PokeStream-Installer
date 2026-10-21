// Detached Windows maintenance bootstrap. Executed by the launcher, never inside Next.js.
// Its handshake and diagnostics remain outside Application so that updates/uninstall
// can safely replace the installed binaries after the Electron parent has exited.
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const allowed=new Set(['update-install.ps1','uninstall.ps1']);

async function launchMaintenance({scriptName,args=[],launcherAssets,parentPid=process.pid,dataDir,environment=process.env,timeoutMs=45000}){
 if(process.platform!=='win32')throw Error('Windows maintenance requires Windows.');
 if(!allowed.has(scriptName))throw Error('Unknown maintenance action.');
 if(!Number.isSafeInteger(parentPid)||parentPid<1)throw Error('Invalid launcher process.');
 const source=path.join(launcherAssets,scriptName);
 const destination=await fsp.mkdtemp(path.join(os.tmpdir(),'PokeStream-maintenance-'));
 const script=path.join(destination,scriptName),ready=path.join(destination,'ready'),failure=path.join(destination,'failure.txt');
 // Do not hold a log file under Studio: uninstall may intentionally delete Studio.
 const log=path.join(path.dirname(dataDir),'maintenance-bootstrap.log');
 await fsp.mkdir(path.dirname(log),{recursive:true});
 try{await fsp.copyFile(source,script);}
 catch(error){await fsp.rm(destination,{recursive:true,force:true}).catch(()=>{});throw Error('Maintenance helper is missing: '+error.message);}
 const fd=fs.openSync(log,'a');
 let child;
 try{
  child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
   '-File',script,'-ParentPid',String(parentPid),'-ReadyFile',ready,'-ErrorFile',failure,...args],
   {detached:true,windowsHide:true,stdio:['ignore',fd,fd],env:{...environment}});
 }finally{fs.closeSync(fd);}
 let spawnError=null;child.on('error',error=>{spawnError=error;});
 const deadline=Date.now()+timeoutMs;
 const message=async()=>{
  try{return (await fsp.readFile(failure,'utf8')).trim();}catch{}
  try{return (await fsp.readFile(log,'utf8')).split(/\r?\n/).slice(-15).join('\n').slice(-2400);}catch{}
  return '';
 };
 while(Date.now()<deadline){
  try{
   if((await fsp.readFile(ready,'utf8')).trim()==='ready'){
    // The helper will retain this file until after the parent exits.
    child.unref();
    return {status:'starting',pid:child.pid,diagnostics:log};
   }
  }catch{}
  if(spawnError||child.exitCode!==null||child.signalCode!==null||fs.existsSync(failure)){
   const reason=(await message())||spawnError?.message||('PowerShell exited with '+child.exitCode);
   throw Error('Maintenance could not start: '+reason);
  }
  await delay(125);
 }
 try{child.kill();}catch{}
 throw Error('Maintenance helper did not acknowledge startup. See '+log+'. '+(await message()));
}
module.exports={launchMaintenance};
