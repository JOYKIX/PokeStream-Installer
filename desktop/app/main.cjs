const {app,BrowserWindow,shell,ipcMain,dialog}=require('electron');
const {spawn}=require('node:child_process');
const {randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
const {createRuntime}=require('./runtime.cjs');
const {createUpdater}=require('./updater.cjs');
const ORIGIN='http://127.0.0.1:47653',DEV=process.env.POKESTREAM_DEV_DESKTOP==='1';
app.setName('PokeStream');app.setAppUserModelId('app.pokestream.desktop');
const home=path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'PokeStream');
const dataDir=path.join(home,'Studio'),installDir=path.join(home,'Application');
const installedExe=path.join(installDir,'PokeStream.exe');
fs.mkdirSync(path.join(dataDir,'browser'),{recursive:true});fs.mkdirSync(path.join(dataDir,'logs'),{recursive:true});
app.setPath('userData',path.join(dataDir,'browser'));
const resources=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../.artifacts/runtime');
const launcherAssets=path.join(resources,'launcher');
let window,server,engine,updater,quitting=false,busy=false,running=false,instance='',lastPage='/users',logDescriptor;
let state={version:app.getVersion(),installed:false,phase:'ready',progress:null,error:'',busy:false,running:false,update:{status:'idle',progress:null}};
function publish(patch){state={...state,...patch};if(window&&!window.isDestroyed())window.webContents.send('pokestream:launcher:state',state);}
const runtime=createRuntime({resources,installDirectory:installDir,version:app.getVersion(),notify:publish});
function log(message){fs.appendFileSync(path.join(dataDir,'logs','launcher.log'),new Date().toISOString()+' '+message+'\n');}
function external(url){try{const u=new URL(url);if(u.protocol==='https:'||(u.protocol==='http:'&&u.origin===ORIGIN))void shell.openExternal(u.href);}catch{}}
async function showLauncher(){if(!window)return;const url=window.webContents.getURL();if(url.startsWith(ORIGIN+'/'))lastPage=new URL(url).pathname;
 await window.loadFile(path.join(launcherAssets,'launcher.html'));publish({running,installed:DEV||!!runtime.current()});}
function stopChildren(){for(const child of [engine,server]){try{child?.kill();}catch{}}engine=null;server=null;running=false;}
function failed(error){log(error.stack||String(error));publish({phase:'error',error:error.message||String(error),busy:false,progress:null,running});}
async function guarded(task){if(busy)return;busy=true;publish({busy:true,error:''});try{return await task();}catch(error){failed(error);return {error:error.message};}finally{busy=false;publish({busy:false});}}
async function installLauncher(){
 if(!app.isPackaged||process.platform!=='win32')return;
 // electron-builder's portable wrapper supplies the durable source EXE (process.execPath is extracted in TEMP).
 const source=process.env.PORTABLE_EXECUTABLE_FILE;
 if(!source||!fs.existsSync(source))return;
 await fsp.mkdir(installDir,{recursive:true});
 if(path.resolve(source).toLowerCase()!==installedExe.toLowerCase()){
  const temp=installedExe+'.new';await fsp.copyFile(source,temp);await fsp.rename(temp,installedExe);
 }
 const options={target:installedExe,cwd:installDir,description:'PokeStream',appUserModelId:'app.pokestream.desktop'};
 const startMenu=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');
 await fsp.mkdir(startMenu,{recursive:true});shell.writeShortcutLink(path.join(startMenu,'PokeStream.lnk'),'create',options);
 shell.writeShortcutLink(path.join(app.getPath('desktop'),'PokeStream.lnk'),'create',options);
}
async function install(repair=false){
 if(running)throw Error('Close the application before repairing its files.');
 if(DEV){publish({installed:true,phase:'ready'});return;}
 if(repair||!runtime.current())await runtime.install();
 await installLauncher();publish({installed:true,phase:'ready',progress:100});
}
async function waitServer(child){
 const deadline=Date.now()+90000;
 while(Date.now()<deadline){
  if(child&&(child.exitCode!==null||child.signalCode!==null))throw Error('The local server stopped. Open the logs for details.');
  try{const response=await fetch(ORIGIN+'/api/local/health',{signal:AbortSignal.timeout(1200)});
   if(response.ok&&(await response.json()).instance===instance)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('The local server did not respond. Open the logs, then try again.');
}
async function launch(){
 if(running){await window.loadURL(ORIGIN+lastPage);return;}
 const root=DEV?resources:runtime.current();
 if(!root&&!DEV)throw Error('Install PokeStream before opening it.');
 publish({phase:'starting',progress:null,error:''});
 const free=DEV||await new Promise(resolve=>{const socket=net.createServer();socket.once('error',()=>resolve(false));socket.listen(47653,'127.0.0.1',()=>socket.close(()=>resolve(true)));});
 if(!free)throw Error('Port 47653 is already in use. Close the other PokeStream process, then retry.');
 instance=process.env.POKESTREAM_INSTANCE||randomUUID();
 const env={...process.env,POKESTREAM_LOCAL:'1',POKESTREAM_DATA_DIR:dataDir,POKESTREAM_IPC_DIR:path.join(dataDir,'engine'),
  POKESTREAM_ENGINE_TOKEN:process.env.POKESTREAM_ENGINE_TOKEN||randomBytes(32).toString('hex'),POKESTREAM_ENGINE_ID:process.env.POKESTREAM_ENGINE_ID||randomUUID(),
  POKESTREAM_PARENT_PID:String(process.pid),POKESTREAM_INSTANCE:instance,POKESTREAM_SITE:ORIGIN,PORT:'47653',HOSTNAME:'127.0.0.1',NODE_ENV:DEV?'development':'production'};
 for(const key of Object.keys(env))if(/^(SUPABASE_|PATREON_|FIREBASE_|NEXT_PUBLIC_SUPABASE)/.test(key))delete env[key];
 fs.mkdirSync(env.POKESTREAM_IPC_DIR,{recursive:true});
 // Old status/commands must not appear as a live engine or execute after restarting.
 for(const name of ['status.json','command.json'])await fsp.rm(path.join(env.POKESTREAM_IPC_DIR,name),{force:true});
 logDescriptor=fs.openSync(path.join(dataDir,'logs','application.log'),'w');
 if(!DEV){
  server=spawn(process.execPath,[path.join(launcherAssets,'server.cjs'),path.join(root,'web','server.js')],{cwd:path.join(root,'web'),env:{...env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore',logDescriptor,logDescriptor]});
  server.on('error',error=>failed(error));
 }
 try{
  await waitServer(server);
  const executable=DEV?path.resolve(__dirname,'../connect/dist/win-x64/PokeStream Connect.exe'):path.join(root,'engine','PokeStream Connect.exe');
  if(fs.existsSync(executable)){
   engine=spawn(executable,['--local'],{cwd:path.dirname(executable),env,windowsHide:true,stdio:['ignore',logDescriptor,logDescriptor]});
   engine.on('error',error=>{log('Connect: '+error.message);publish({engineError:error.message});});
   engine.on('exit',(code,signal)=>{if(!quitting){log('Connect exited: '+code+' '+signal);publish({engineError:'Connect stopped. Restart PokeStream to reconnect.'});}});
  }else if(!DEV)throw Error('Connect engine missing. Use Repair in the launcher.');
  if(server)server.on('exit',code=>{if(!quitting&&running){running=false;stopChildren();void showLauncher().then(()=>failed(Error('The local server stopped ('+code+'). Open the logs, then retry.')));}});
  await window.loadURL(ORIGIN+lastPage);running=true;publish({running:true,phase:'ready',progress:null});
 }catch(error){stopChildren();throw error;}
 finally{if(logDescriptor!==undefined){fs.closeSync(logDescriptor);logDescriptor=undefined;}}
}
async function installUpdate(){
 const item=updater.getDownloaded();if(!item)throw Error('Download the update first.');
 const script=path.join(home,'Updates','install.ps1');await fsp.mkdir(path.dirname(script),{recursive:true});await fsp.copyFile(path.join(launcherAssets,'update-install.ps1'),script);
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',script,'-ParentPid',String(process.pid),'-Source',item.path,'-Destination',installedExe,'-ExpectedHash',item.sha256],{detached:true,windowsHide:true,stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();app.quit();return {status:'starting'};
}
function trusted(event){if(!window||event.sender!==window.webContents)throw Error('Unknown window.');const url=event.senderFrame?.url||'';if(!url.startsWith(ORIGIN+'/')&&!url.startsWith('file://'))throw Error('Unknown page.');}
function handle(channel,task){ipcMain.handle(channel,async(event,...args)=>{trusted(event);return task(...args);});}
handle('pokestream:launcher:state',()=>state);
handle('pokestream:open-data',()=>shell.openPath(dataDir));
handle('pokestream:launcher:open',showLauncher);
handle('pokestream:updates:check',()=>updater.check());
handle('pokestream:updates:download',()=>updater.download());
handle('pokestream:updates:install',()=>guarded(installUpdate));
handle('pokestream:launcher:action',action=>{
 if(action==='minimize')return window.minimize();if(action==='close')return app.quit();
 if(action==='logs')return shell.openPath(path.join(dataDir,'logs'));
 if(action==='data')return shell.openPath(dataDir);
 if(action==='check')return updater.check();if(action==='download')return updater.download();
 if(action==='update')return guarded(installUpdate);
 if(action==='install')return guarded(()=>install(false));if(action==='repair')return guarded(()=>install(true));
 if(action==='launch')return guarded(launch);throw Error('Unknown launcher action.');
});
async function start(){
 window=new BrowserWindow({title:'PokeStream',width:1180,height:800,minWidth:980,minHeight:680,backgroundColor:'#09090b',show:false,
  autoHideMenuBar:true,titleBarStyle:'hidden',titleBarOverlay:{color:'#0c0c0f',symbolColor:'#f4f4f5',height:38},
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(ORIGIN+'/')){event.preventDefault();external(url);}});
 window.webContents.on('render-process-gone',(_event,details)=>{log('Renderer: '+details.reason);if(!quitting)void showLauncher().then(()=>failed(Error('The interface stopped. Reopen PokeStream.')));});
 window.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 window.once('ready-to-show',()=>window.show());window.on('closed',()=>{window=null;app.quit();});
 updater=createUpdater({app,directory:path.join(home,'Updates'),notify:update=>publish({update:{...state.update,...update}})});
 state.installed=DEV||!!runtime.current();await showLauncher();void updater.check();
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(start).catch(error=>{log(error.stack||String(error));dialog.showErrorBox('PokeStream',error.message);app.quit();});
}
app.on('before-quit',()=>{quitting=true;stopChildren();});app.on('window-all-closed',()=>app.quit());
