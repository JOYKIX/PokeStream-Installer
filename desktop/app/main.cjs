const {app,BrowserWindow,shell,ipcMain,dialog}=require('electron');
const {spawn}=require('node:child_process');
const os=require('node:os');
const {randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
const {createRuntime}=require('./runtime.cjs');
const {createInstallation,samePath}=require('./installation.cjs');
const {createUpdater}=require('./updater.cjs');
const ORIGIN='http://127.0.0.1:47653',DEV=process.env.POKESTREAM_DEV_DESKTOP==='1',startedAt=Date.now();
app.setName('PokeStream');app.setAppUserModelId('app.pokestream.desktop');
const home=path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'PokeStream');
const dataDir=path.join(home,'Studio'),installDir=path.join(home,'Application');
fs.mkdirSync(path.join(dataDir,'browser'),{recursive:true});fs.mkdirSync(path.join(dataDir,'logs'),{recursive:true});
app.setPath('userData',path.join(dataDir,'browser'));
const resources=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../.artifacts/runtime');
const launcherAssets=path.join(resources,'launcher');
let window,server,engine,updater,quitting=false,busy=false,running=false,serverReady=false,servicesPromise=null,serviceEpoch=0,lastPage='/users';
const preferenceFile=path.join(dataDir,'desktop-preferences.json');
const languages=['en','fr','es','de','ja'];
let language='auto';try{const saved=JSON.parse(fs.readFileSync(preferenceFile,'utf8')).language;if(languages.includes(saved))language=saved;}catch{}
function languageState(){const system=(app.getPreferredSystemLanguages()[0]||'en').toLowerCase().split('-')[0];return {preference:language,locale:language==='auto'?(languages.includes(system)?system:'en'):language};}
let languageSave=Promise.resolve();
function saveLanguage(value){
 if(value!=='auto'&&!languages.includes(value))throw Error('Unsupported language.');
 languageSave=languageSave.catch(()=>{}).then(async()=>{
  const file=preferenceFile+'.tmp';await fsp.writeFile(file,JSON.stringify({language:value}));await fsp.rename(file,preferenceFile);language=value;
  if(window){
   const session=window.webContents.session;session.setUserAgent(session.getUserAgent(),languageState().locale);
   if(value==='auto')await session.cookies.remove(ORIGIN,'pokestream-language');
   else await session.cookies.set({url:ORIGIN,name:'pokestream-language',value,path:'/',sameSite:'lax',expirationDate:Date.now()/1000+31536000});
   await session.cookies.flushStore();
   window.webContents.send('pokestream:language:changed',value);
  }return languageState();
 });return languageSave;
}
let state={version:app.getVersion(),installed:false,phase:'ready',progress:null,error:'',busy:false,running:false,update:{status:'idle',progress:null}};
const runtime=createRuntime({resources,installDirectory:installDir,version:app.getVersion(),notify:publish});
const installation=createInstallation({directory:installDir,version:app.getVersion(),notify:publish});
function publish(patch){state={...state,...patch};if(window&&!window.isDestroyed())window.webContents.send('pokestream:launcher:state',state);}
function log(message){fs.appendFileSync(path.join(dataDir,'logs','launcher.log'),new Date().toISOString()+' '+message+'\n');}
async function openLogs(){const file=path.join(home,'maintenance.log');if(fs.existsSync(file))await fsp.copyFile(file,path.join(dataDir,'logs','maintenance.log'));return shell.openPath(path.join(dataDir,'logs'));}
function external(url){try{const u=new URL(url);if(u.protocol==='https:'||(u.protocol==='http:'&&u.origin===ORIGIN))void shell.openExternal(u.href);}catch{}}
async function showLauncher(){if(!window)return;const url=window.webContents.getURL();if(url.startsWith(ORIGIN+'/'))lastPage=new URL(url).pathname;
 await window.loadFile(path.join(launcherAssets,'launcher.html'));publish({running,installed:DEV||!!runtime.current()&&!!installation.current()});}
function stopChildren(){serviceEpoch++;for(const child of [engine,server]){try{child?.kill();}catch{}}engine=null;server=null;serverReady=false;servicesPromise=null;running=false;}
function failed(error){log(error.stack||String(error));publish({phase:'error',error:error.message||String(error),busy:false,progress:null,running});}
async function guarded(task){if(busy)return;busy=true;publish({busy:true,error:''});try{return await task();}catch(error){failed(error);return {error:error.message};}finally{busy=false;publish({busy:false});}}
async function handoff(target,args=[]){
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('PORTABLE_'))delete env[key];
 // The installed executable must be able to acquire the same single-instance lock.
 app.releaseSingleInstanceLock();
 try{
  const child=spawn(target,args,{cwd:path.dirname(target),env,detached:true,windowsHide:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();app.quit();
 }catch(error){app.requestSingleInstanceLock();throw error;}
}
async function installDesktop(repair=false){
 if(!app.isPackaged)return process.execPath;
 const target=await installation.install(path.dirname(process.execPath),{force:repair});
 // Retain the stable setup entry point for existing pins; normal shortcuts use the real installed EXE.
 const source=process.env.PORTABLE_EXECUTABLE_FILE,setup=path.join(installDir,'PokeStream.exe');
 if(source&&fs.existsSync(source)&&!samePath(source,setup)){const temp=setup+'.new';await fsp.copyFile(source,temp);await fsp.rename(temp,setup);}
 const options={target,cwd:path.dirname(target),description:'PokeStream',appUserModelId:'app.pokestream.desktop'};
 const menu=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');await fsp.mkdir(menu,{recursive:true});
 shell.writeShortcutLink(path.join(menu,'PokeStream.lnk'),'create',options);shell.writeShortcutLink(path.join(app.getPath('desktop'),'PokeStream.lnk'),'create',options);
 return target;
}
async function install(repair=false){
 if(running)throw Error('Close the application before repairing its files.');
 if(DEV){publish({installed:true,phase:'ready'});return;}
 stopChildren();
 const backups=await Promise.all(['runtime.json','desktop.json'].map(async name=>{try{return [name,await fsp.readFile(path.join(installDir,name))];}catch{return [name,null];}}));
 let target;
 try{if(repair||!runtime.current())await runtime.install();target=await installDesktop(repair);}
 catch(error){for(const [name,contents] of backups){const file=path.join(installDir,name);if(contents){const temp=file+'.rollback';await fsp.writeFile(temp,contents);await fsp.rename(temp,file);}else await fsp.rm(file,{force:true});}throw error;}
 publish({installed:true,phase:'ready',progress:100});
 if(!samePath(process.execPath,target))await handoff(target,process.argv.includes('--apply-update')?['--open-app']:[]);
 else void prepareServer().catch(error=>{log('Preload: '+error.message);});
}
const env={...process.env,POKESTREAM_LOCAL:'1',POKESTREAM_DATA_DIR:dataDir,POKESTREAM_IPC_DIR:path.join(dataDir,'engine'),
 POKESTREAM_ENGINE_TOKEN:process.env.POKESTREAM_ENGINE_TOKEN||randomBytes(32).toString('hex'),POKESTREAM_ENGINE_ID:process.env.POKESTREAM_ENGINE_ID||randomUUID(),
 POKESTREAM_PARENT_PID:String(process.pid),POKESTREAM_INSTANCE:process.env.POKESTREAM_INSTANCE||randomUUID(),POKESTREAM_SITE:ORIGIN,PORT:'47653',HOSTNAME:'127.0.0.1',NODE_ENV:DEV?'development':'production'};
for(const key of Object.keys(env))if(/^(SUPABASE_|PATREON_|FIREBASE_|NEXT_PUBLIC_SUPABASE)/.test(key)||key.startsWith('PORTABLE_'))delete env[key];
async function waitServer(child){
 const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  if(child&&(child.exitCode!==null||child.signalCode!==null||child.spawnError))throw Error('The local server stopped. Open the logs for details.');
  try{const response=await fetch(ORIGIN+'/api/local/health',{signal:AbortSignal.timeout(800)});if(response.ok&&(await response.json()).instance===env.POKESTREAM_INSTANCE)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('The local server did not respond. Open the logs, then try again.');
}
function prepareServer(){
 if(serverReady)return Promise.resolve();if(servicesPromise)return servicesPromise;
 const epoch=serviceEpoch;let child=null;
 servicesPromise=(async()=>{
  const root=DEV?resources:runtime.current();if(!root&&!DEV)throw Error('Install PokeStream before opening it.');
  const free=DEV||await new Promise(resolve=>{const socket=net.createServer();socket.once('error',()=>resolve(false));socket.listen(47653,'127.0.0.1',()=>socket.close(()=>resolve(true)));});
  if(!free)throw Error('Port 47653 is already in use. Close the other PokeStream process, then retry.');
  if(!DEV){
   const logFile=fs.openSync(path.join(dataDir,'logs','application.log'),'w');
   try{child=server=spawn(process.execPath,[path.join(launcherAssets,'server.cjs'),path.join(root,'web','server.js')],{cwd:path.join(root,'web'),env:{...env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore',logFile,logFile]});}
   finally{fs.closeSync(logFile);}
   child.on('error',error=>{child.spawnError=error;log('Server: '+error.message);});
   child.on('exit',code=>{if(epoch!==serviceEpoch||server!==child)return;serverReady=false;servicesPromise=null;if(!quitting&&running){stopChildren();void showLauncher().then(()=>failed(Error('The local server stopped ('+code+'). Open the logs, then retry.')));}});
  }
  await waitServer(child);if(epoch!==serviceEpoch)throw Error('Server preparation cancelled.');serverReady=true;log('Server ready in '+(Date.now()-startedAt)+' ms');
  // Preload the profile screen while the user is in the launcher; no profile is modified.
  void fetch(ORIGIN+'/users',{signal:AbortSignal.timeout(10000)}).catch(()=>{});
 })().catch(error=>{if(epoch===serviceEpoch){servicesPromise=null;try{child?.kill();}catch{}if(server===child)server=null;}throw error;});
 return servicesPromise;
}
async function startEngine(){
 if(engine)return;
 const root=DEV?resources:runtime.current(),executable=DEV?path.resolve(__dirname,'../connect/dist/win-x64/PokeStream Connect.exe'):path.join(root,'engine','PokeStream Connect.exe');
 if(!fs.existsSync(executable)){if(!DEV)throw Error('Connect engine missing. Use Repair in the launcher.');return;}
 await fsp.mkdir(env.POKESTREAM_IPC_DIR,{recursive:true});for(const name of ['status.json','command.json'])await fsp.rm(path.join(env.POKESTREAM_IPC_DIR,name),{force:true});
 const output=fs.openSync(path.join(dataDir,'logs','connect.log'),'w');
 try{engine=spawn(executable,['--local'],{cwd:path.dirname(executable),env,windowsHide:true,stdio:['ignore',output,output]});}finally{fs.closeSync(output);}
 engine.on('error',error=>{log('Connect: '+error.message);publish({engineError:error.message});});
 engine.on('exit',(code,signal)=>{engine=null;if(!quitting){log('Connect exited: '+code+' '+signal);publish({engineError:'Connect stopped. Restart PokeStream to reconnect.'});}});
}
async function launch(){
 if(running){await window.loadURL(ORIGIN+lastPage);return;}
 const target=installation.current();if(app.isPackaged&&target&&!samePath(process.execPath,target))return handoff(target,['--open-app']);
 publish({phase:'starting',progress:null,error:''});await prepareServer();
 await Promise.all([startEngine(),window.loadURL(ORIGIN+lastPage)]);running=true;publish({running:true,phase:'ready',progress:null});log('Interface ready in '+(Date.now()-startedAt)+' ms');
}
async function maintenance(scriptName,args=[]){
 publish({phase:scriptName==='uninstall.ps1'?'uninstalling':'updating',progress:null});
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'PokeStream-maintenance-'));
 const script=path.join(directory,scriptName),ready=path.join(directory,'ready');
 await fsp.copyFile(path.join(launcherAssets,scriptName),script);
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',script,'-ParentPid',String(process.pid),'-ReadyFile',ready,...args],{detached:true,windowsHide:true,stdio:'ignore'});
 let failure=null;child.on('error',error=>{failure=error;});
 const deadline=Date.now()+30000;
 while(!fs.existsSync(ready)){
  if(failure||child.exitCode!==null||Date.now()>deadline)throw failure||Error('Maintenance could not start. Open the logs and try again.');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 // The helper is running outside Application and has checked its inputs before we exit.
 child.unref();stopChildren();app.quit();return {status:'starting'};
}
async function installUpdate(){
 const item=await updater.verify();
 return maintenance('update-install.ps1',['-Source',item.path,'-ExpectedHash',item.sha256,'-ExpectedVersion',item.version]);
}
async function uninstall(options){
 if(DEV||!state.installed)throw Error('PokeStream is not installed.');
 if(options?.confirm!==true||typeof options.keepData!=='boolean')throw Error('Confirm uninstall first.');
 return maintenance('uninstall.ps1',options.keepData?[]:['-RemoveData']);
}

function trusted(event){if(!window||event.sender!==window.webContents)throw Error('Unknown window.');const url=event.senderFrame?.url||'';if(!url.startsWith(ORIGIN+'/')&&!url.startsWith('file://'))throw Error('Unknown page.');}
function handle(channel,task){ipcMain.handle(channel,async(event,...args)=>{trusted(event);return task(...args);});}
handle('pokestream:launcher:state',()=>state);handle('pokestream:open-data',()=>shell.openPath(dataDir));handle('pokestream:launcher:open',showLauncher);
handle('pokestream:updates:check',()=>updater.check());handle('pokestream:updates:download',()=>updater.download());handle('pokestream:updates:install',()=>guarded(installUpdate));
handle('pokestream:language:get',languageState);handle('pokestream:language:set',saveLanguage);
handle('pokestream:launcher:uninstall',options=>guarded(()=>uninstall(options)));
handle('pokestream:launcher:action',action=>{
 if(action==='minimize')return window.minimize();if(action==='close')return app.quit();if(action==='logs')return openLogs();if(action==='data')return shell.openPath(dataDir);
 if(action==='check')return updater.check();if(action==='download')return updater.download();if(action==='update')return guarded(installUpdate);
 if(action==='install')return guarded(()=>install(false));if(action==='repair')return guarded(()=>install(true));if(action==='launch')return guarded(launch);throw Error('Unknown launcher action.');
});
async function start(){
 // A previously downloaded setup forwards to the installed launcher. Shortcuts skip this bootstrap entirely.
 const target=installation.current();if(app.isPackaged&&target&&!samePath(process.execPath,target)&&!process.argv.includes('--repair')&&!process.argv.includes('--apply-update'))return handoff(target,process.argv.includes('--open-app')?['--open-app']:[]);
 window=new BrowserWindow({title:'PokeStream',width:1180,height:800,minWidth:980,minHeight:680,backgroundColor:'#09090b',show:false,autoHideMenuBar:true,titleBarStyle:'hidden',titleBarOverlay:{color:'#0c0c0f',symbolColor:'#f4f4f5',height:38},webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(ORIGIN+'/')){event.preventDefault();external(url);}});
 window.webContents.on('render-process-gone',(_event,details)=>{log('Renderer: '+details.reason);if(!quitting)void showLauncher().then(()=>failed(Error('The interface stopped. Reopen PokeStream.')));});
 window.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));window.once('ready-to-show',()=>window.show());window.on('closed',()=>{window=null;app.quit();});
 updater=createUpdater({app,directory:path.join(home,'Updates'),notify:update=>publish({update:{...state.update,...update}})});
 if(!fs.existsSync(preferenceFile)){const previous=await window.webContents.session.cookies.get({url:ORIGIN,name:"pokestream-language"});if(languages.includes(previous[0]?.value))language=previous[0].value;}
 await saveLanguage(language);
 try{const last=JSON.parse(await fsp.readFile(path.join(home,'maintenance.json'),'utf8'));if(last.success===false)state.error=last.message;}catch{}
 state.installed=DEV||!!runtime.current()&&!!target;await showLauncher();log('Launcher ready in '+(Date.now()-startedAt)+' ms');void updater.check();
 if(process.argv.includes('--apply-update'))await guarded(()=>install());
 else if(process.argv.includes('--open-app'))await guarded(launch);
 else if(state.installed)void prepareServer().catch(error=>log('Preload: '+error.message));
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',(_event,argv)=>{if(argv.includes('--open-app')&&state.installed&&!busy)void guarded(launch);if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(start).catch(error=>{log(error.stack||String(error));dialog.showErrorBox('PokeStream',error.message);app.quit();});
}
app.on('before-quit',()=>{quitting=true;stopChildren();});app.on('window-all-closed',()=>app.quit());
