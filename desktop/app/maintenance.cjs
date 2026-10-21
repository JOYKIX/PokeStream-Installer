// Native Windows maintenance relay. A Node child with unref() still belongs to
// libuv's kill-on-close Job Object. A short, attached PowerShell bootstrap uses
// native Process.Start to launch the independent worker outside that job.
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const quote=value=>"'"+String(value).replace(/'/g,"''")+"'";
const encoded=value=>Buffer.from(value,'utf16le').toString('base64');
function maintenanceEnvironment(environment){
 const env={...environment};
 for(const name of Object.keys(env))if(/^(PSModulePath|NODE_OPTIONS|NODE_PATH|NODE_CHANNEL_FD|ELECTRON_RUN_AS_NODE|POKESTREAM_PARENT_PID|POKESTREAM_INSTANCE|POKESTREAM_ENGINE_TOKEN|POKESTREAM_ENGINE_ID)$/i.test(name)||name.startsWith('PORTABLE_'))delete env[name];
 return env;
}
function validateArguments(scriptName,args){
 if(scriptName==='uninstall.ps1'&&(!args.length||(args.length===1&&args[0]==='-RemoveData')))return;
 if(scriptName==='update-install.ps1'&&(args.length===6||(args.length===7&&['-Repair','-UpdateLauncher'].includes(args[6])))&&args[0]==='-Source'&&typeof args[1]==='string'&&args[2]==='-ExpectedHash'&&/^[a-f0-9]{64}$/.test(args[3])&&args[4]==='-ExpectedVersion'&&/^\d+\.\d+\.\d+$/.test(args[5]))return;
 throw Error('Invalid maintenance parameters.');
}
async function launchMaintenance({scriptName,args=[],launcherAssets,parentPid=process.pid,dataDir,environment=process.env,timeoutMs=60000}){
 if(process.platform!=='win32')throw Error('Windows maintenance requires Windows.');
 if(!Number.isSafeInteger(parentPid)||parentPid<1)throw Error('Invalid launcher process.');
 validateArguments(scriptName,args);
 const destination=await fsp.mkdtemp(path.join(os.tmpdir(),'PokeStream-maintenance-'));
 const script=path.join(destination,scriptName),ready=path.join(destination,'ready'),failure=path.join(destination,'failure.txt');
 const commitFile=path.join(destination,'commit'),cancelFile=path.join(destination,'cancel'),pidFile=path.join(destination,'worker.pid'),resultFile=path.join(destination,'result.json');
 const log=path.join(path.dirname(dataDir),'maintenance-bootstrap.log');
 await fsp.mkdir(path.dirname(log),{recursive:true});
 try{for(const name of [scriptName,'maintenance-common.ps1'])await fsp.copyFile(path.join(launcherAssets,name),path.join(destination,name));}
 catch(error){await fsp.rm(destination,{recursive:true,force:true}).catch(()=>{});throw Error('Maintenance helper is missing: '+error.message);}
 const powershell=path.join(environment.SystemRoot||environment.SYSTEMROOT||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const command="& "+quote(script)+" -ParentPid "+parentPid+" -ReadyFile "+quote(ready)+" -ErrorFile "+quote(failure)+" -CommitFile "+quote(commitFile)+" -CancelFile "+quote(cancelFile)+" -ResultFile "+quote(resultFile)+
  args.map(value=>['-RemoveData','-Repair','-UpdateLauncher'].includes(value)?' '+value:value.startsWith('-')?' '+value:' '+quote(value)).join('');
 const bootstrap="$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; try { "+
  "$p=New-Object System.Diagnostics.ProcessStartInfo; $p.FileName="+quote(powershell)+"; "+
  "$p.Arguments="+quote('-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand '+encoded(command))+"; "+
  "$p.UseShellExecute=$false; $p.CreateNoWindow=$true; $p.WorkingDirectory="+quote(destination)+"; "+
  "$c=[Diagnostics.Process]::Start($p); [IO.File]::WriteAllText("+quote(pidFile)+",[string]$c.Id) "+
  "} catch { [IO.File]::WriteAllText("+quote(failure)+",$_.Exception.Message); exit 1 }";
 const fd=fs.openSync(log,'a');let child,spawnError=null;
 try{child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-OutputFormat','Text','-EncodedCommand',encoded(bootstrap)],
  {cwd:destination,windowsHide:true,stdio:['ignore',fd,fd],env:maintenanceEnvironment(environment)});}
 finally{fs.closeSync(fd);}
 child.on('error',error=>{spawnError=error;});
 const abort=async()=>{await fsp.writeFile(cancelFile,'cancel').catch(()=>{});};
 const message=async()=>{try{return (await fsp.readFile(failure,'utf8')).trim();}catch{}return spawnError?.message||'See '+log;};
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){
  if(spawnError||fs.existsSync(failure)||(child.exitCode!==null&&child.exitCode!==0)){
   await abort();throw Error('Maintenance could not start: '+await message());
  }
  try{
   if((await fsp.readFile(ready,'utf8')).trim()==='ready'){
    const pid=Number(await fsp.readFile(pidFile,'utf8'));
    if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid maintenance process.');
    process.kill(pid,0);
    child.unref();
    return {status:'starting',pid,diagnostics:log,abort,wait:async({onProgress}={})=>{
     const deadline=Date.now()+360000;
     while(Date.now()<deadline){
      try{const result=JSON.parse(await fsp.readFile(resultFile,'utf8'));if(result.success!==true)throw Error(result.message||'Maintenance failed.');return result;}
      catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
      try{const p=JSON.parse(await fsp.readFile(path.join(destination,'progress.json'),'utf8'));if(['verifying','installing','ready'].includes(p.phase)&&(p.progress===null||Number.isFinite(p.progress)))onProgress?.(p);}catch{}
      if(fs.existsSync(failure))throw Error(await message());
      try{process.kill(pid,0);}catch{throw Error('Maintenance stopped before completing. See '+log);}
      await delay(200);
     }
     throw Error('Maintenance is taking too long. See '+log);
    },commit:async()=>{
     if(fs.existsSync(failure)||fs.existsSync(cancelFile))throw Error('Maintenance was cancelled: '+await message());
     process.kill(pid,0);
     await fsp.writeFile(commitFile,'commit',{flag:'wx'});
    }};
   }
  }catch(error){if(error.code!=='ENOENT'){await abort();throw error;}}
  await delay(125);
 }
 await abort();
 throw Error('Maintenance did not acknowledge startup. '+await message());
}
module.exports={launchMaintenance,maintenanceEnvironment};
