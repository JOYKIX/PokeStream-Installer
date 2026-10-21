const {app,BrowserWindow,shell,ipcMain,dialog}=require("electron");
const {spawn}=require("node:child_process");
const {randomBytes,randomUUID}=require("node:crypto");
const fs=require("node:fs"),path=require("node:path"),net=require("node:net");
const ORIGIN="http://127.0.0.1:47653";
const DEV=process.env.POKESTREAM_DEV_DESKTOP==="1";
let window,server,engine,quitting=false;
app.setName("PokeStream");
const dataDir=path.join(process.env.LOCALAPPDATA||app.getPath("userData"),"PokeStream","Studio");
// Electron requires the target directory to exist on first launch.
fs.mkdirSync(path.join(dataDir,"browser"),{recursive:true});
app.setPath("userData",path.join(dataDir,"browser"));
if(!app.requestSingleInstanceLock()){app.quit();}
else{
 app.on("second-instance",()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(start).catch(error=>{dialog.showErrorBox("PokeStream",error.message);app.quit();});
}
function external(url){try{const u=new URL(url);if(u.protocol==="https:"||u.protocol==="http:"&&u.hostname==="127.0.0.1")shell.openExternal(url);}catch{}}
async function waitServer(child){
 for(let i=0;i<150;i++){if(child && child.exitCode!==null)throw Error("Le serveur local n’a pas pu démarrer. Consulte le dossier logs.");
 try{const r=await fetch(ORIGIN+"/api/local/health",{signal:AbortSignal.timeout(1000)});if(r.ok){const data=await r.json();if(data.instance===process.env.POKESTREAM_INSTANCE)return;}}
 catch{}await new Promise(r=>setTimeout(r,200));}
 throw Error("Le serveur local ne répond pas. Ferme PokeStream et relance-le.");
}
async function start(){
 fs.mkdirSync(path.join(dataDir,"logs"),{recursive:true});fs.mkdirSync(path.join(dataDir,"engine"),{recursive:true});
 const free=DEV?true:await new Promise(resolve=>{const s=net.createServer();s.once("error",()=>resolve(false));s.listen(47653,"127.0.0.1",()=>s.close(()=>resolve(true)));});
 if(!free)throw Error("Le port local 47653 est déjà utilisé. Ferme l’autre instance de PokeStream, puis relance l’application.");
 const root=app.isPackaged?process.resourcesPath:path.resolve(__dirname,"../../.artifacts/runtime");
 const env={...process.env,POKESTREAM_LOCAL:"1",POKESTREAM_DATA_DIR:dataDir,POKESTREAM_IPC_DIR:path.join(dataDir,"engine"),
 POKESTREAM_ENGINE_TOKEN:process.env.POKESTREAM_ENGINE_TOKEN||randomBytes(32).toString("hex"),POKESTREAM_ENGINE_ID:process.env.POKESTREAM_ENGINE_ID||randomUUID(),POKESTREAM_PARENT_PID:String(process.pid),
 POKESTREAM_SITE:ORIGIN,POKESTREAM_INSTANCE:process.env.POKESTREAM_INSTANCE||randomUUID(),PORT:"47653",HOSTNAME:"127.0.0.1",NODE_ENV:"production"};
 process.env.POKESTREAM_INSTANCE=env.POKESTREAM_INSTANCE;
 // The portable package contains no environment files or remote service credentials.
 for(const key of Object.keys(env))if(/^(SUPABASE_|PATREON_|FIREBASE_|NEXT_PUBLIC_SUPABASE)/.test(key))delete env[key];
 const log=fs.openSync(path.join(dataDir,"logs","application.log"),"w");
 if(!DEV)server=spawn(process.execPath,[path.join(root,"web","server.js")],{cwd:path.join(root,"web"),env:{...env,ELECTRON_RUN_AS_NODE:"1"},windowsHide:true,stdio:["ignore",log,log]});
 window=new BrowserWindow({title:"PokeStream",width:1440,height:960,minWidth:980,minHeight:680,backgroundColor:"#09090b",show:false,
 autoHideMenuBar:true,titleBarStyle:"hidden",titleBarOverlay:{color:"#111114",symbolColor:"#eeeeef",height:34},
 webPreferences:{preload:path.join(__dirname,"preload.cjs"),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 window.loadFile(path.join(__dirname,"loading.html"));window.once("ready-to-show",()=>window.show());
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:"deny"};});
 window.webContents.on("will-navigate",(e,url)=>{if(!url.startsWith(ORIGIN+"/")){e.preventDefault();external(url);}});
 window.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 window.on("closed",()=>{window=null;app.quit();});
 require("./updater.cjs").init(window);
 // Always verify the server identity, including in development.
await waitServer(server);
 const executable=DEV?path.resolve(__dirname,"../connect/dist/win-x64/PokeStream Connect.exe"):path.join(root,"engine","PokeStream Connect.exe");
 if(fs.existsSync(executable)){engine=spawn(executable,["--local"],{cwd:path.dirname(executable),env,windowsHide:true,stdio:["ignore",log,log]});
 engine.on("error",error=>dialog.showErrorBox("PokeStream — Connect",error.message));}
 else if(!DEV)throw Error("Moteur Connect absent du package. Reconstruis le logiciel avant de le distribuer.");
 if(server)server.on("exit",()=>{if(!quitting){dialog.showErrorBox("PokeStream","Le serveur local s’est arrêté. Tes créations restent sur ce PC.");app.quit();}});
 await window.loadURL(ORIGIN+"/users");
}
ipcMain.handle("pokestream:open-data",()=>shell.openPath(dataDir));
app.on("before-quit",()=>{quitting=true;engine?.kill();server?.kill();});
app.on("window-all-closed",()=>app.quit());
