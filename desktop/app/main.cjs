const {app,BrowserWindow,shell,ipcMain,dialog}=require('electron');
const {spawn}=require('node:child_process');
const {randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {createRuntime}=require('./runtime.cjs');
const {createInstallation,samePath}=require('./installation.cjs');
const {createUpdater}=require('./updater.cjs');
const {recover,rollbackUpdate,cleanVersions}=require('./modular-update.cjs');
const {launchMaintenance}=require('./maintenance.cjs');
const {acquireOperation}=require('./operation-lock.cjs');
const {createWorkspaceControl,workspaceRecord,workspaceCommand,stopWorkspace}=require('./workspace-control.cjs');
const ORIGIN='http://127.0.0.1:47653',DEV=process.env.POKESTREAM_DEV_DESKTOP==='1',startedAt=Date.now();
const VERSION=app.getVersion(),LAUNCHER_VERSION=require(path.join(app.getAppPath(),'package.json')).launcherVersion||'1.0.0';
const installerMode=process.argv.includes('--install-only');
const workspaceMode=!installerMode&&(process.argv.includes('--workspace')||/^desktop-/.test(path.basename(path.dirname(process.execPath))));
const home=path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'PokeStream');
const dataDir=path.join(home,'Studio'),installDir=path.join(home,'Application'),launcherDir=path.join(home,'Launcher');
const userData=installerMode?path.join(os.tmpdir(),'PokeStream-setup-'+process.pid):workspaceMode?path.join(dataDir,'browser'):path.join(launcherDir,'browser');
fs.mkdirSync(userData,{recursive:true});fs.mkdirSync(path.join(dataDir,'logs'),{recursive:true});
app.setName(workspaceMode?'PokeStream':'PokeStream Launcher');app.setAppUserModelId(workspaceMode?'app.pokestream.desktop':'app.pokestream.launcher');app.setPath('userData',userData);
const resources=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../.artifacts/runtime'),launcherAssets=path.join(resources,'launcher');
let window,server,engine,updater,control,quitting=false,busy=false,running=false,serverReady=false,servicesPromise=null,serviceEpoch=0,refreshTimer;
const pageArgument=process.argv.find(arg=>arg.startsWith('--page='));
let lastPage=pageArgument?.slice(7)==='/settings#sprite-library'?'/settings#sprite-library':'/users',pendingPage=lastPage.startsWith('/settings')?lastPage:null;
const preferenceFile=path.join(dataDir,'desktop-preferences.json'),languages=['en','fr','es','de','ja'];let language='auto';
try{const value=JSON.parse(fs.readFileSync(preferenceFile,'utf8')).language;if(languages.includes(value))language=value;}catch{}
function languageState(){const system=(app.getPreferredSystemLanguages()[0]||'en').toLowerCase().split('-')[0];return {preference:language,locale:language==='auto'?(languages.includes(system)?system:'en'):language};}
let languageSave=Promise.resolve();
function saveLanguage(value){
 if(value!=='auto'&&!languages.includes(value))throw Error('Unsupported language.');
 languageSave=languageSave.catch(()=>{}).then(async()=>{
  await fsp.mkdir(dataDir,{recursive:true});const temp=preferenceFile+'.'+process.pid;await fsp.writeFile(temp,JSON.stringify({language:value}));await fsp.rename(temp,preferenceFile);language=value;
  if(window&&workspaceMode){
   const session=window.webContents.session;session.setUserAgent(session.getUserAgent(),languageState().locale);
   if(value==='auto')await session.cookies.remove(ORIGIN,'pokestream-language');
   else await session.cookies.set({url:ORIGIN,name:'pokestream-language',value,path:'/',sameSite:'lax',expirationDate:Date.now()/1000+31536000});
   await session.cookies.flushStore();window.webContents.send('pokestream:language:changed',value);
  }
  if(!workspaceMode&&!installerMode)await workspaceCommand(dataDir,'language',value).catch(()=>{});
  return languageState();
 });return languageSave;
}
function installedApplication(){
 try{
  const desktop=JSON.parse(fs.readFileSync(path.join(installDir,'desktop.json'),'utf8')),record=JSON.parse(fs.readFileSync(path.join(installDir,'runtime.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(desktop.version)||desktop.version!==record.version||!/^desktop-[\w.-]+$/.test(desktop.directory)||!/^runtime-[\w.-]+$/.test(record.directory))return null;
  const directory=path.join(installDir,desktop.directory),executable=path.join(directory,'PokeStream.exe');
  if(!fs.existsSync(executable)||!fs.existsSync(path.join(directory,'resources/app.asar'))||!fs.existsSync(path.join(installDir,record.directory,'web/server.js')))return null;
  return {version:desktop.version,directory,executable};
 }catch{return null;}
}
function installedLauncher(){
 try{const r=JSON.parse(fs.readFileSync(path.join(launcherDir,'launcher.json'),'utf8'));if(!/^\d+\.\d+\.\d+$/.test(r.version)||!/^launcher-[\w.-]+$/.test(r.directory))return null;const file=path.join(launcherDir,r.directory,'PokeStream Launcher.exe');return fs.existsSync(file)?file:null;}catch{return null;}
}
function notes(){try{const info=installedApplication();return JSON.parse(fs.readFileSync(path.join(info?path.join(info.directory,'resources'):resources,'launcher/release-notes.json'),'utf8'));}catch{return null;}}
let state={version:installedApplication()?.version||VERSION,launcherVersion:LAUNCHER_VERSION,releaseNotes:notes(),installed:!!installedApplication(),phase:'ready',progress:null,error:'',busy:false,running:false,update:{status:'idle',progress:null}};
function publish(patch){state={...state,...patch};if(installerMode){try{const file=installerResultPath();if(file)fs.writeFileSync(path.join(path.dirname(file),'progress.json'),JSON.stringify({phase:state.phase,progress:state.progress}));}catch{}}if(window&&!window.isDestroyed())window.webContents.send('pokestream:launcher:state',state);}
function log(message){fs.mkdirSync(path.join(dataDir,'logs'),{recursive:true});fs.appendFileSync(path.join(dataDir,'logs',workspaceMode?'application-shell.log':'launcher.log'),new Date().toISOString()+' '+message+'\n');}
function external(url){try{const u=new URL(url);if(u.protocol==='https:'||(u.protocol==='http:'&&u.origin===ORIGIN))void shell.openExternal(u.href);}catch{}}
async function openLogs(){for(const name of ['maintenance.log','maintenance-bootstrap.log']){const file=path.join(home,name);if(fs.existsSync(file))await fsp.copyFile(file,path.join(dataDir,'logs',name));}return shell.openPath(path.join(dataDir,'logs'));}
function failed(error){log(error.stack||String(error));publish({phase:'error',error:error.message||String(error),progress:null});}
async function guarded(task){if(busy)return;busy=true;publish({busy:true,error:''});try{return await task();}catch(error){failed(error);return {error:error.message};}finally{busy=false;publish({busy:false});}}
async function refreshInstallation(){const info=installedApplication();running=!!await workspaceRecord(dataDir);publish({installed:DEV||!!info,version:info?.version||VERSION,releaseNotes:notes(),running});}
const runtime=createRuntime({resources,installDirectory:installDir,version:VERSION,notify:publish});
const launcher=createInstallation({directory:launcherDir,version:LAUNCHER_VERSION,prefix:'launcher',manifest:'launcher.json',executableName:'PokeStream Launcher.exe',notify:publish});
async function handoff(target,args=[]){
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('PORTABLE_'))delete env[key];
 app.releaseSingleInstanceLock();
 try{const child=spawn(target,args,{cwd:path.dirname(target),env,detached:true,windowsHide:false,stdio:'ignore'});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();app.quit();}
 catch(error){app.requestSingleInstanceLock();throw error;}
}
async function writeShortcuts(appTarget,launcherTarget){
 const menu=path.join(app.getPath('appData'),'Microsoft/Windows/Start Menu/Programs');await fsp.mkdir(menu,{recursive:true});
 for(const [name,target,id] of [['PokeStream',appTarget,'app.pokestream.desktop'],['PokeStream Launcher',launcherTarget,'app.pokestream.launcher']]){
  if(!target)continue;const options={target,cwd:path.dirname(target),description:name,appUserModelId:id};
  for(const directory of [menu,app.getPath('desktop')])shell.writeShortcutLink(path.join(directory,name+'.lnk'),'create',options);
 }
}
async function installPackages({repair=false,includeLauncher=false}={}){
 publish({phase:'installing',progress:null,error:''});
 if(includeLauncher&&!launcher.current())await launcher.install(path.dirname(process.execPath),{sourceExecutable:path.basename(process.execPath)});
 await updater.check({repair:true,...(installerMode?{version:VERSION}:{})});
 await updater.download();
 const result=await applyPreparedUpdate({resume:false,notifyCheck:false});
 await writeShortcuts(result.target,installedLauncher());
 publish({installed:true,version:result.version,phase:'ready',progress:100});return {...result,launcherTarget:installedLauncher()};
}
async function install(){
 if(DEV){publish({installed:true,phase:'ready'});return;}
 const result=await installPackages({includeLauncher:true});
 await refreshInstallation();
 if(result.launcherTarget&&!samePath(result.launcherTarget,process.execPath))await handoff(result.launcherTarget,['--launcher']);
}
function stopChildren(){serviceEpoch++;for(const child of [engine,server]){try{child?.kill();}catch{}}engine=null;server=null;serverReady=false;servicesPromise=null;}
async function stopServices(){
 const children=[engine,server].filter(Boolean);stopChildren();
 await Promise.all(children.map(child=>new Promise((resolve,reject)=>{
  if(child.exitCode!==null||child.signalCode!==null)return resolve();
  const timer=setTimeout(()=>{cleanup();reject(Error('Application services are still stopping.'));},15000);
  const done=()=>{cleanup();resolve();};const cleanup=()=>{clearTimeout(timer);child.off('exit',done);};child.once('exit',done);
 })));
}
const env={...process.env,POKESTREAM_LOCAL:'1',POKESTREAM_DATA_DIR:dataDir,POKESTREAM_IPC_DIR:path.join(dataDir,'engine'),POKESTREAM_ENGINE_TOKEN:(DEV&&process.env.POKESTREAM_ENGINE_TOKEN)||randomBytes(32).toString('hex'),POKESTREAM_ENGINE_ID:(DEV&&process.env.POKESTREAM_ENGINE_ID)||randomUUID(),POKESTREAM_PARENT_PID:String(process.pid),POKESTREAM_INSTANCE:(DEV&&process.env.POKESTREAM_INSTANCE)||randomUUID(),POKESTREAM_SITE:ORIGIN,PORT:'47653',HOSTNAME:'127.0.0.1',NODE_ENV:DEV?'development':'production'};
for(const key of Object.keys(env))if(/^(SUPABASE_|PATREON_|FIREBASE_|NEXT_PUBLIC_SUPABASE)/.test(key)||key.startsWith('PORTABLE_'))delete env[key];
async function waitServer(child){
 const deadline=Date.now()+30000;while(Date.now()<deadline){
  if(child&&(child.exitCode!==null||child.signalCode!==null||child.spawnError))throw Error('The local server stopped. Open the logs for details.');
  try{const r=await fetch(ORIGIN+'/api/local/health',{signal:AbortSignal.timeout(800)});if(r.ok&&(await r.json()).instance===env.POKESTREAM_INSTANCE)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }throw Error('The local server did not respond. Open the logs, then retry.');
}
function prepareServer(){
 if(serverReady)return Promise.resolve();if(servicesPromise)return servicesPromise;const epoch=serviceEpoch;let child=null;
 servicesPromise=(async()=>{
  const root=DEV?resources:runtime.current();if(!root&&!DEV)throw Error('Application files are incomplete. Open the launcher and repair PokeStream.');
  const free=DEV||await new Promise(resolve=>{const socket=net.createServer();socket.once('error',()=>resolve(false));socket.listen(47653,'127.0.0.1',()=>socket.close(()=>resolve(true)));});
  if(!free)throw Error('Port 47653 is already in use. Close the other PokeStream process, then retry.');
  if(!DEV){
   const output=fs.openSync(path.join(dataDir,'logs/application.log'),'w');
   try{child=server=spawn(process.execPath,[path.join(launcherAssets,'server.cjs'),path.join(root,'web/server.js')],{cwd:path.join(root,'web'),env:{...env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore',output,output]});}finally{fs.closeSync(output);}
   child.on('error',error=>{child.spawnError=error;log('Server: '+error.message);});
   child.on('exit',code=>{if(epoch!==serviceEpoch||server!==child)return;serverReady=false;servicesPromise=null;if(!quitting){failed(Error('The local server stopped ('+code+'). Restart PokeStream.'));void openLauncher().finally(()=>app.quit());}});
  }
  await waitServer(child);if(epoch!==serviceEpoch)throw Error('Server preparation cancelled.');serverReady=true;log('Server ready in '+(Date.now()-startedAt)+' ms');
 })().catch(error=>{if(epoch===serviceEpoch){servicesPromise=null;try{child?.kill();}catch{}if(server===child)server=null;}throw error;});return servicesPromise;
}
async function startEngine(){
 if(engine)return;const root=DEV?resources:runtime.current(),executable=DEV?path.resolve(__dirname,'../connect/dist/win-x64/PokeStream Connect.exe'):path.join(root,'engine/PokeStream Connect.exe');
 if(!fs.existsSync(executable)){if(!DEV)throw Error('Connect engine missing. Use Repair in the launcher.');return;}
 await fsp.mkdir(env.POKESTREAM_IPC_DIR,{recursive:true});for(const name of ['status.json','command.json'])await fsp.rm(path.join(env.POKESTREAM_IPC_DIR,name),{force:true});
 const output=fs.openSync(path.join(dataDir,'logs/connect.log'),'w');
 try{engine=spawn(executable,['--local'],{cwd:path.dirname(executable),env,windowsHide:true,stdio:['ignore',output,output]});}finally{fs.closeSync(output);}
 engine.on('error',error=>{log('Connect: '+error.message);publish({engineError:error.message});});
 engine.on('exit',(code,signal)=>{engine=null;if(!quitting){log('Connect exited: '+code+' '+signal);publish({engineError:'Connect stopped. Restart PokeStream to reconnect.'});}});
}
async function spawnNative(target,args=[]){
 const clean={...process.env};for(const key of Object.keys(clean))if(key.startsWith('PORTABLE_')||key==='ELECTRON_RUN_AS_NODE')delete clean[key];
 const child=spawn(target,args,{cwd:path.dirname(target),env:clean,detached:true,windowsHide:false,stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();return child;
}
async function openLauncher(){
 if(!workspaceMode){window?.show();window?.focus();return;}
 const target=installedLauncher();if(!target)throw Error('Launcher is missing. Run PokeStream-Setup.exe to reinstall it.');
 await spawnNative(target,['--launcher']);
}
async function launchWorkspace(page,allowRollback=true){
 const record=await workspaceRecord(dataDir);
 if(record){await workspaceCommand(dataDir,'focus',page);await refreshInstallation();return;}
 const info=installedApplication();if(!info&&!DEV)throw Error('Install PokeStream before opening it.');
 publish({phase:'starting',progress:null,error:''});
 try{await spawnNative(DEV?process.execPath:info.executable,DEV?[app.getAppPath(),'--workspace',...(page?['--page='+page]:[])]:['--workspace',...(page?['--page='+page]:[])]);
 const deadline=Date.now()+45000;
 while(Date.now()<deadline){if(await workspaceRecord(dataDir)){await workspaceCommand(dataDir,'focus',page);await refreshInstallation();publish({phase:'ready',progress:null});return;}await new Promise(resolve=>setTimeout(resolve,150));}
 throw Error('PokeStream could not open. Open the logs or repair the application.');
 }catch(error){if(allowRollback&&info&&await rollbackUpdate({installDir,expectedVersion:info.version})){log('Restored previous app after failed startup: '+info.version);await refreshInstallation();await launchWorkspace(page,false);return;}throw error;}
}
async function maintenance(scriptName,args=[],{resume=false,updateLauncher=false}={}){
 publish({phase:scriptName==='uninstall.ps1'?'uninstalling':'updating',progress:null,error:''});
 await stopWorkspace(dataDir);await refreshInstallation();
 const release=await acquireOperation(path.join(home,'Updates'),{purpose:'maintenance'});
 let worker=null,finished=false;
 try{
 const operation=await launchMaintenance({scriptName,args,launcherAssets,parentPid:process.pid,dataDir});
 worker=operation;try{await release.transfer(operation.pid);}catch(error){await operation.abort();worker=null;throw error;}
 log('Independent maintenance ready; worker PID '+operation.pid);
 try{await operation.commit();await operation.wait({onProgress:value=>publish({phase:value.phase==='ready'?'updating':value.phase,progress:value.progress})});finished=true;}catch(error){await operation.abort();throw error;}
 await refreshInstallation();publish({phase:'ready',progress:null,error:''});
 if(updateLauncher){const next=launcher.current(); // current() refers to THIS version; resolve the new manifest separately.
  let target=next;try{const r=JSON.parse(await fsp.readFile(path.join(launcherDir,'launcher.json'),'utf8'));if(/^launcher-[\w.-]+$/.test(r.directory))target=path.join(launcherDir,r.directory,'PokeStream Launcher.exe');}catch{}
  if(target&&!samePath(target,process.execPath))return handoff(target,['--launcher',...(resume?['--resume-app']:[])]);
 }
 if(resume)await launchWorkspace();
 updater.reset();void updater.check().catch(error=>log(error.message));
 return {status:'completed'};
 }finally{let alive=false;if(worker)try{process.kill(worker.pid,0);alive=true;}catch{}if(finished||!alive)await release();}
}
async function applyPreparedUpdate({resume=false,notifyCheck=true}={}){
 await updater.verify();publish({phase:'updating',progress:null,error:''});
 await stopWorkspace(dataDir);
 const result=await updater.install();await writeShortcuts(result.target,result.launcherTarget||installedLauncher());
 await refreshInstallation();publish({phase:'ready',progress:null,error:''});
 if(result.launcherTarget&&!samePath(result.launcherTarget,process.execPath)&&!installerMode){
  await handoff(result.launcherTarget,['--launcher',...(resume?['--resume-app']:[])]);
 }else if(resume)await launchWorkspace();
 if(notifyCheck){updater.reset();void updater.check().catch(error=>log(error.message));}
 return result;
}
async function installUpdate(){
 await updater.ensurePrepared();
 return applyPreparedUpdate({resume:!!await workspaceRecord(dataDir)});
}
async function repair(){
 if(!installedApplication())throw Error('PokeStream is not installed.');
 const resume=!!await workspaceRecord(dataDir);
 await updater.check({repair:true});await updater.download();return applyPreparedUpdate({resume});
}
async function uninstall(options){
 if(DEV||!state.installed)throw Error('PokeStream is not installed.');
 if(options?.confirm!==true||typeof options.keepData!=='boolean')throw Error('Confirm uninstall first.');
 return maintenance('uninstall.ps1',options.keepData?[]:['-RemoveData']);
}
function trusted(event){if(!window||event.sender!==window.webContents)throw Error('Unknown window.');const url=event.senderFrame?.url||'';if(!url.startsWith(ORIGIN+'/')&&!url.startsWith('file://'))throw Error('Unknown page.');}
function handle(channel,task){ipcMain.handle(channel,async(event,...args)=>{trusted(event);return task(...args);});}
handle('pokestream:launcher:state',()=>state);handle('pokestream:open-data',async()=>{await fsp.mkdir(dataDir,{recursive:true});return shell.openPath(dataDir);});handle('pokestream:launcher:open',openLauncher);
handle('pokestream:language:get',languageState);handle('pokestream:language:set',saveLanguage);
handle('pokestream:updates:check',()=>busy?state.update:updater.check());handle('pokestream:updates:download',()=>workspaceMode?openLauncher():guarded(()=>updater.download()));
handle('pokestream:updates:install',()=>workspaceMode?openLauncher():guarded(installUpdate));
handle('pokestream:launcher:uninstall',options=>workspaceMode?openLauncher():guarded(()=>uninstall(options)));
handle('pokestream:launcher:action',action=>{
 if(action==='minimize')return window.minimize();if(action==='close')return app.quit();if(action==='logs')return openLogs();if(action==='data'){fs.mkdirSync(dataDir,{recursive:true});return shell.openPath(dataDir);}
 if(action==='releases')return external('https://github.com/JOYKIX/PokeStream-Installer/releases/latest');
 if(workspaceMode)return openLauncher();
 if(action==='check')return busy?state.update:updater.check();if(action==='download')return guarded(()=>updater.download());if(action==='update')return guarded(installUpdate);
 if(action==='install')return guarded(install);if(action==='repair')return guarded(repair);if(action==='launch')return guarded(()=>launchWorkspace());if(action==='sprites')return guarded(()=>launchWorkspace('/settings#sprite-library'));
 throw Error('Unknown launcher action.');
});
function createWindow(){
 window=new BrowserWindow({title:workspaceMode?'PokeStream':'PokeStream Launcher',width:1180,height:800,minWidth:980,minHeight:680,backgroundColor:'#09090b',show:false,autoHideMenuBar:true,titleBarStyle:'hidden',titleBarOverlay:{color:'#0d0d10',symbolColor:'#f4f4f5',height:workspaceMode?38:59},webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(ORIGIN+'/')){event.preventDefault();external(url);}});
 window.webContents.on('render-process-gone',(_event,details)=>{log('Renderer: '+details.reason);if(!quitting){if(workspaceMode)void openLauncher().finally(()=>app.quit());else void window.loadFile(path.join(launcherAssets,'launcher.html')).then(()=>failed(Error('The interface stopped. Reopen PokeStream.')));}});
 window.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 window.once('ready-to-show',()=>window.show());window.on('closed',()=>{window=null;app.quit();});
}
async function startWorkspace(){
 createWindow();const continueToPage=(_event,url)=>{if(!pendingPage||!url.startsWith(ORIGIN+'/')||new URL(url).pathname==='/users')return;const target=pendingPage;pendingPage=null;if(url!==ORIGIN+target)void window.loadURL(ORIGIN+target).catch(failed);};
 window.webContents.on('did-navigate',continueToPage);window.webContents.on('did-navigate-in-page',continueToPage);
 if(!fs.existsSync(preferenceFile)){const old=await window.webContents.session.cookies.get({url:ORIGIN,name:'pokestream-language'});if(languages.includes(old[0]?.value))language=old[0].value;}
 await saveLanguage(language);
 await window.loadFile(path.join(launcherAssets,'loading.html'));await prepareServer();
 await Promise.all([startEngine(),window.loadURL(ORIGIN+lastPage)]);
 control=createWorkspaceControl({dataDir,version:VERSION,onCommand:async(action,value)=>{
  if(action==='close'){await stopServices();await control.close();setTimeout(()=>app.quit(),100);return true;}
  if(action==='language'){await saveLanguage(value);window.webContents.reload();return true;}
  if(action==='focus'){if(value==='/settings#sprite-library'){pendingPage=value;await window.loadURL(ORIGIN+value);}if(window.isMinimized())window.restore();window.show();window.focus();return true;}
 }});
 await control.start();running=true;
 if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}
 const marker=path.join(home,'launcher-ready.json');await fsp.writeFile(marker,JSON.stringify({version:VERSION,pid:process.pid,startedAt:new Date().toISOString()}));
 log('Workspace ready in '+(Date.now()-startedAt)+' ms');
 void cleanVersions({installDir,launcherDir,updatesDir:path.join(home,'Updates'),currentExecutable:process.execPath}).catch(error=>log('Cleanup: '+error.message));
}
async function startLauncher(){
 let target=launcher.current();
 if(app.isPackaged&&!target){
  createWindow();await window.loadFile(path.join(launcherAssets,'launcher.html'));publish({busy:true,phase:'installing'});
  target=await launcher.install(path.dirname(process.execPath),{sourceExecutable:path.basename(process.execPath)});
  await writeShortcuts(installedApplication()?.executable,target);
 }
 if(app.isPackaged&&target&&!samePath(process.execPath,target))return handoff(target,['--launcher',...(process.argv.includes('--resume-app')?['--resume-app']:[])]);
 createWindow();await refreshInstallation();
 try{const file=path.join(home,'maintenance.json'),last=JSON.parse(await fsp.readFile(file,'utf8'));if(last.success===false){state.error=last.message;state.phase='error';}await fsp.rm(file,{force:true});}catch{}
 await window.loadFile(path.join(launcherAssets,'launcher.html'));publish(state);log('Launcher '+LAUNCHER_VERSION+' ready in '+(Date.now()-startedAt)+' ms');void updater.check().catch(error=>log(error.message));
 refreshTimer=setInterval(()=>void refreshInstallation().catch(error=>log(error.message)),2500);
 if(process.argv.includes('--resume-app'))await guarded(()=>launchWorkspace());
}
function installerResultPath(){
 const file=process.env.POKESTREAM_INSTALL_RESULT;if(!file)return null;
 const directory=path.dirname(file);if(path.basename(file)!=='installed.json'||!path.basename(directory).startsWith('PokeStream-maintenance-')||!samePath(path.dirname(directory),os.tmpdir()))throw Error('Invalid installer result location.');
 return file;
}
function installerResult(value){const file=installerResultPath();if(!file)return;const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value));fs.renameSync(temp,file);}
async function start(){
 await recover(installDir,launcherDir);
 updater=createUpdater({app:{isPackaged:app.isPackaged,getVersion:()=>installedApplication()?.version||'0.0.0'},launcherVersion:LAUNCHER_VERSION,directory:path.join(home,'Updates'),installDir,launcherDir,
  roots:async()=>{
   const info=installedApplication();let runtimeRoot=null;try{const record=JSON.parse(await fsp.readFile(path.join(installDir,'runtime.json'),'utf8'));if(/^runtime-[\w.-]+$/.test(record.directory))runtimeRoot=path.join(installDir,record.directory);}catch{}
   return {desktop:info?.directory,web:runtimeRoot?path.join(runtimeRoot,'web'):null,engine:runtimeRoot?path.join(runtimeRoot,'engine'):null,bootstrap:path.dirname(process.execPath)};
  },notify:update=>publish({update:{...state.update,...update}})});
 if(installerMode){
  try{await installPackages({repair:process.argv.includes('--repair'),includeLauncher:process.argv.includes('--include-launcher')});installerResult({success:true,version:VERSION,launcherVersion:LAUNCHER_VERSION});app.exit(0);}
  catch(error){log(error.stack||String(error));installerResult({success:false,message:error.message});app.exit(1);}return;
 }
 if(workspaceMode)await startWorkspace();else await startLauncher();
}
if(installerMode||app.requestSingleInstanceLock()){
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(start).catch(error=>{log(error.stack||String(error));if(workspaceMode)void openLauncher().catch(()=>{});dialog.showErrorBox('PokeStream',error.message);app.quit();});
}else app.quit();
app.on('before-quit',()=>{quitting=true;clearInterval(refreshTimer);stopChildren();if(control)void control.close();});
app.on('window-all-closed',()=>app.quit());
