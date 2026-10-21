/* eslint-disable @typescript-eslint/no-require-imports */
// Windows maintenance checks. Destructive operations use disposable LOCALAPPDATA
// directories. The initiating Node process deliberately remains alive throughout.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {launchMaintenance,maintenanceEnvironment}=require('../desktop/app/maintenance.cjs');
const windows=process.platform==='win32';
async function fixture(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'PokeStream-maintenance-test-')),root=path.join(temp,'PokeStream');
 for(const name of ['Application','Updates','Studio','Launcher']){await fs.mkdir(path.join(root,name),{recursive:true});await fs.writeFile(path.join(root,name,'preserve.txt'),'fixture');}
 return {temp,root,dataDir:path.join(root,'Studio'),environment:{...process.env,LOCALAPPDATA:temp,APPDATA:path.join(temp,'Roaming')}};
}
const boot=(f,options)=>launchMaintenance({...options,launcherAssets:path.resolve('desktop/app'),dataDir:f.dataDir,environment:f.environment,timeoutMs:20000});
async function uninstall(keepData){
 const f=await fixture();try{
  const op=await boot(f,{scriptName:'uninstall.ps1',args:keepData?[]:['-RemoveData']});
  assert(sync.existsSync(path.join(f.root,'Application','preserve.txt')),'No deletion before commit');
  await op.commit();assert.equal((await op.wait()).success,true);
  assert(!sync.existsSync(path.join(f.root,'Application')));assert(!sync.existsSync(path.join(f.root,'Updates')));
  assert.equal(sync.existsSync(path.join(f.root,'Studio','preserve.txt')),keepData);
  assert(sync.existsSync(path.join(f.root,'Launcher','preserve.txt')));process.kill(process.pid,0);
 }finally{await fs.rm(f.temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
}
test('Uninstall retains launcher and user data by default',{skip:!windows},()=>uninstall(true));
test('Explicit user data removal retains the separate launcher',{skip:!windows},()=>uninstall(false));
test('Corrupted installer is rejected before handoff; launcher remains alive',{skip:!windows},async()=>{
 const f=await fixture();try{
  const file=path.join(f.root,'Updates','PokeStream-9.9.9.exe');await fs.writeFile(file,'corrupt');
  await assert.rejects(boot(f,{scriptName:'update-install.ps1',args:['-Source',file,'-ExpectedHash','0'.repeat(64),'-ExpectedVersion','9.9.9']}),/SHA256 mismatch/);
  assert(sync.existsSync(path.join(f.root,'Application','preserve.txt')));process.kill(process.pid,0);
 }finally{await fs.rm(f.temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('Cancelled helper cannot uninstall after acknowledgement',{skip:!windows},async()=>{
 const f=await fixture();try{
  const op=await boot(f,{scriptName:'uninstall.ps1'});await op.abort();await assert.rejects(op.wait(),/cancelled/i);
  assert(sync.existsSync(path.join(f.root,'Application','preserve.txt')));
 }finally{await fs.rm(f.temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('App installation waits for the real installer result with launcher open',{skip:!windows},async()=>{
 const f=await fixture();try{
  const file=path.join(f.root,'Updates','PokeStream-9.9.9.exe'),source=file+'.cs';
  await fs.writeFile(source,'using System;using System.IO;public class Fixture{public static void Main(){string root=Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA"),"PokeStream","Application");Directory.CreateDirectory(root);string json="{\\"version\\":\\"9.9.9\\"}";File.WriteAllText(Path.Combine(root,"desktop.json"),json);File.WriteAllText(Path.Combine(root,"runtime.json"),json);File.WriteAllText(Environment.GetEnvironmentVariable("POKESTREAM_INSTALL_RESULT"),"{\\"success\\":true,\\"version\\":\\"9.9.9\\",\\"launcherVersion\\":\\"1.0.0\\"}");}}');
  const quote=p=>"'"+p.replace(/'/g,"''")+"'";
  const built=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -Path '+quote(source)+' -OutputAssembly '+quote(file)+' -OutputType WindowsApplication'],{encoding:'utf8',windowsHide:true,env:maintenanceEnvironment(process.env)});
  assert.equal(built.status,0,built.stderr+' '+built.stdout);
  const hash=createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const op=await boot(f,{scriptName:'update-install.ps1',args:['-Source',file,'-ExpectedHash',hash,'-ExpectedVersion','9.9.9']});
  await op.commit();const result=await op.wait();assert.equal(result.success,true);assert.equal(result.version,'9.9.9');
  assert(sync.existsSync(path.join(f.root,'Studio','preserve.txt')));assert(sync.existsSync(path.join(f.root,'Launcher','preserve.txt')));process.kill(process.pid,0);
 }finally{await fs.rm(f.temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
