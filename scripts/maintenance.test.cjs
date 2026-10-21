/* eslint-disable @typescript-eslint/no-require-imports */
// Windows-only end-to-end smoke tests for the actual PowerShell maintenance scripts.
// All destructive operations are confined to isolated temporary LOCALAPPDATA roots.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {launchMaintenance}=require('../desktop/app/maintenance.cjs');

const windows=process.platform==='win32';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(){
 const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'PokeStream-maintenance-test-'));
 const root=path.join(temp,'PokeStream');
 for(const name of ['Application','Updates','Studio']){
  await fsp.mkdir(path.join(root,name),{recursive:true});
  await fsp.writeFile(path.join(root,name,'preserve.txt'),'test fixture');
 }
 return {temp,root,dataDir:path.join(root,'Studio'),environment:{...process.env,LOCALAPPDATA:temp,APPDATA:path.join(temp,'Roaming')}};
}
async function launchFakeParent(){
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command','Start-Sleep -Milliseconds 2200'],{windowsHide:true,stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
 return child;
}
async function waitForStatus(root){
 const target=path.join(root,'maintenance.json');
 for(let i=0;i<240;i++){
  try{return JSON.parse(await fsp.readFile(target,'utf8'));}catch{}
  await sleep(125);
 }
 throw Error('Maintenance status was not written; inspect '+root);
}
async function fakeWindowsInstaller(file,version){
 const sourceFile=file+'.cs';
 const literal='{"version":"'+version+'"}';
 const csharp=[
  'using System; using System.IO;',
  'public class PokeStreamFixture { public static int Main(string[] args) {',
  '  string root=Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA"),"PokeStream","Application");',
  '  Directory.CreateDirectory(root);',
  '  File.WriteAllText(Path.Combine(root,"runtime.json"),'+JSON.stringify(literal)+');',
  '  File.WriteAllText(Path.Combine(root,"desktop.json"),'+JSON.stringify(literal)+');',
  '  return 0; } }'
 ].join('\n');
 await fsp.writeFile(sourceFile,csharp);
 const quote=p=>"'"+p.replace(/'/g,"''")+"'";
 const command='Add-Type -Path '+quote(sourceFile)+' -OutputAssembly '+quote(file)+' -OutputType ConsoleApplication';
 const built=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(built.status,0,'Could not compile Windows fixture: '+built.stderr+' '+built.stdout);
 const hash=createHash('sha256').update(await fsp.readFile(file)).digest('hex');
 return hash;
}
async function run({keepData,updateError,updateSuccess}={}){
 const a=await fixture();
 const parent=await launchFakeParent();
 try{
  const version='9.9.9';
  const updateFile=path.join(a.root,'Updates','PokeStream-'+version+'.exe');
  if(updateError)await fsp.writeFile(updateFile,'not a valid signed update');
  const updateHash=updateSuccess?await fakeWindowsInstaller(updateFile,version):'0'.repeat(64);
  const parameters=(updateError||updateSuccess)?{
   scriptName:'update-install.ps1',
   args:['-Source',updateFile,'-ExpectedHash',updateHash,'-ExpectedVersion',version]
  }:{
   scriptName:'uninstall.ps1',
   args:keepData?[]:['-RemoveData']
  };
  const boot=await launchMaintenance({...parameters,launcherAssets:path.resolve('desktop/app'),
   parentPid:parent.pid,dataDir:a.dataDir,environment:a.environment,timeoutMs:12000});
  assert.equal(boot.status,'starting');
  const result=await waitForStatus(a.root);
  if(updateError){
   assert.equal(result.success,false);
   assert.match(result.message,/SHA256 mismatch/i);
   assert.equal(fs.existsSync(path.join(a.root,'Application','preserve.txt')),true);
   assert.equal(fs.existsSync(updateFile),true);
  }else if(updateSuccess){
   assert.equal(result.success,true,JSON.stringify(result));
   assert.equal(result.version,version);
   for(const name of ['runtime.json','desktop.json']) {
    const installed=JSON.parse(await fsp.readFile(path.join(a.root,'Application',name),'utf8'));
    assert.equal(installed.version,version);
   }
   assert.equal(fs.existsSync(path.join(a.root,'Studio','preserve.txt')),true);
  }else{
   assert.equal(result.success,true,JSON.stringify(result));
   assert.equal(fs.existsSync(path.join(a.root,'Application')),false);
   assert.equal(fs.existsSync(path.join(a.root,'Updates')),false);
   assert.equal(fs.existsSync(path.join(a.root,'Studio','preserve.txt')),keepData);
  }
 }catch(error){
  const diagnostic=path.join(a.root,'maintenance-bootstrap.log');
  const nativeLog=path.join(a.root,'maintenance.log');
  for(const logFile of [diagnostic,nativeLog]){
   try{error.message+='\n'+logFile+':\n'+(await fsp.readFile(logFile,'utf8')).slice(-5000);}catch{}
  }
  throw error;
 }finally{
  if(parent.exitCode===null){try{parent.kill();}catch{}}
  await fsp.rm(a.temp,{force:true,recursive:true,maxRetries:10,retryDelay:150}).catch(()=>{});
 }
}

test('PowerShell non-detached process executes file arguments correctly', {skip:!windows},async()=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'PokeStream-probe-'));
 const script=path.join(dir,'probe.ps1'),ready=path.join(dir,'ready.txt');
 await fsp.writeFile(script,"param([string]$ReadyFile)\n[IO.File]::WriteAllText($ReadyFile,'ready')\nWrite-Output 'Powershell script executed'\n");
 try {
  for(const detached of [false]){
   await fsp.rm(ready,{force:true});
   const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-ReadyFile',ready],{windowsHide:true,detached,stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
   const exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
   assert.equal(exitCode,0,'PowerShell did not execute: '+stderr+' | '+stdout);
   assert.equal(fs.existsSync(ready),true,'Missing ready file; detached='+detached+'; output='+JSON.stringify(stdout)+'; error='+JSON.stringify(stderr)+'; code='+exitCode+'; args='+JSON.stringify(child.spawnargs));
  }
 }finally{await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{});}
});

test('Uninstall keeps profiles and removes only product binaries', {skip:!windows},async()=>run({keepData:true}));
test('Uninstall explicitly removes local user data when requested', {skip:!windows},async()=>run({keepData:false}));
test('Updater rejects corrupted EXE after safe handoff and preserves installation', {skip:!windows},async()=>run({updateError:true}));

test('Updater installs verified Windows EXE and records both runtime manifests', {skip:!windows},async()=>run({updateSuccess:true}));
