// PokeStream's dependency-free Windows updater. It fetches verified official
// GitHub Release assets and only installs after explicit user confirmation.
const {app,dialog,ipcMain}=require('electron');
const https=require('node:https');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawn}=require('node:child_process');
const {Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const RELEASE='https://api.github.com/repos/JOYKIX/PokeStream-Installer/releases/latest';
const MAX_INSTALLER=900*1024*1024;
let downloaded=null,checking=null,mainWindow=null,lastCheck=null;
const semver=v=>String(v||'').replace(/^v/,'').split('.').map(x=>Number(x)||0);
function newer(a,b){let x=semver(a),y=semver(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;}
function get(url,max=1024*1024,redirects=5){return new Promise((resolve,reject)=>{
 if(redirects<0)return reject(new Error('Trop de redirections.'));
 const u=new URL(url);if(u.protocol!=='https:')return reject(new Error('URL non sécurisée.'));
 const req=https.get(u,{headers:{'User-Agent':'PokeStream-Updater','Accept':'application/vnd.github+json'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){const next=new URL(res.headers.location||'',u);res.resume();if(!['github.com','api.github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(next.hostname)&&!next.hostname.endsWith('.githubusercontent.com'))return reject(new Error('Domaine de téléchargement non autorisé.'));return get(next.toString(),max,redirects-1).then(resolve,reject);}
  if(res.statusCode!==200){res.resume();return reject(new Error(`GitHub HTTP ${res.statusCode}`));}
  let chunks=[],len=0;res.on('data',b=>{len+=b.length;if(len>max){req.destroy(new Error('Téléchargement trop volumineux.'));return;}chunks.push(b);});res.on('end',()=>resolve(Buffer.concat(chunks)));res.on('error',reject);
 });req.setTimeout(20000,()=>req.destroy(new Error('Délai de connexion dépassé.')));req.on('error',reject);
});}
async function remote(){
 if(!app.isPackaged)return {status:'development',version:app.getVersion()};
 const release=JSON.parse((await get(RELEASE)).toString('utf8'));
 if(release.draft||release.prerelease)throw new Error("La release actuelle n’est pas une version stable.");
 const assets=release.assets||[];
 const installer=assets.find(a=>/^PokeStream-Setup-\d+\.\d+\.\d+-win-x64\.exe$/.test(a.name));
 const sums=assets.find(a=>a.name==='SHA256SUMS.txt');
 if(!installer||!sums)throw new Error('La dernière release ne contient pas les fichiers de mise à jour attendus.');
 const ver=String(release.tag_name||'').replace(/^v/,'');
 if(!/^\d+\.\d+\.\d+$/.test(ver)||!installer.name.includes(`-${ver}-`))throw new Error('Version de release invalide.');
 const lines=(await get(sums.browser_download_url,128*1024)).toString('utf8').split(/\r?\n/);
 const match=lines.map(l=>l.match(/^([a-f\d]{64})\s+\*?(.+)$/i)).find(m=>m&&m[2]===installer.name);
 if(!match)throw new Error('Empreinte SHA256 du programme absente.');
 return {status:newer(ver,app.getVersion())?'available':'current',version:ver,current:app.getVersion(),url:installer.browser_download_url,size:installer.size,sha256:match[1].toLowerCase()};
}
async function check(){if(checking)return checking;checking=remote().then(r=>{lastCheck=r;return {status:r.status,version:r.version,current:r.current};}).finally(()=>checking=null);return checking;}
function showError(e){dialog.showMessageBox({type:'warning',title:'Mises à jour PokeStream',message:e.message||String(e),buttons:['Fermer']}).catch(()=>{});}
async function streamInstaller(url,target,item,redirects=5){
 if(redirects<0)throw Error('Trop de redirections.');
 const u=new URL(url);if(u.protocol!=='https:')throw Error('URL non sécurisée.');
 return new Promise((resolve,reject)=>{
  const req=https.get(u,{headers:{'User-Agent':'PokeStream-Updater'}},async res=>{
   if([301,302,303,307,308].includes(res.statusCode)){
    const next=new URL(res.headers.location||'',u);res.resume();
    if(!['github.com','api.github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(next.hostname)&&!next.hostname.endsWith('.githubusercontent.com'))return reject(Error('Domaine de téléchargement non autorisé.'));
    try{await streamInstaller(next.toString(),target,item,redirects-1);resolve();}catch(error){reject(error);}
    return;
   }
   if(res.statusCode!==200){res.resume();return reject(Error(`GitHub HTTP ${res.statusCode}`));}
   let size=0;const hash=createHash('sha256');
   const verify=new Transform({transform(chunk,_encoding,callback){
    size+=chunk.length;
    if(size>MAX_INSTALLER||size>item.size)return callback(Error('Taille de téléchargement invalide.'));
    hash.update(chunk);callback(null,chunk);
   }});
   try{
    // pipeline awaits file closure, unlike the 'finish' event. Windows can then rename the EXE.
    await pipeline(res,verify,fs.createWriteStream(target,{flags:'w',mode:0o600}));
    if(size!==item.size||hash.digest('hex')!==item.sha256)throw Error('Échec de vérification SHA256.');
    resolve();
   }catch(error){try{await fs.promises.rm(target,{force:true});}catch{}reject(error);}
  });
  req.setTimeout(60000,()=>req.destroy(Error('Connexion trop lente ou interrompue.')));
  req.on('error',reject);
 });
}
async function downloadUpdate(){
 if(!lastCheck||lastCheck.status!=='available')return {status:'unavailable'};
 const item=lastCheck;
 if(item.size>MAX_INSTALLER||item.size<1)throw Error('Taille du programme invalide.');
 const target=path.join(os.tmpdir(),`PokeStream-Setup-${item.version}-win-x64.exe`);
 const temp=target+'.partial';
 try { await streamInstaller(item.url,temp,item); fs.rmSync(target,{force:true}); fs.renameSync(temp,target); }
 catch(error){ try{fs.rmSync(temp,{force:true});}catch{} throw error; }
 downloaded=target;return {status:'ready',version:item.version};
}
function install(){if(!downloaded||!fs.existsSync(downloaded))throw Error('Mise à jour non téléchargée.');
 const file=downloaded;
 // Start after old Electron/Connect/server processes have had time to terminate.
 const command=`Start-Sleep -Seconds 4; Start-Process -FilePath '${file.replace(/'/g,"''")}'`;
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',command],{detached:true,windowsHide:true,stdio:'ignore'});
 child.unref();app.quit();return {status:'starting'};
}
function init(window){mainWindow=window;
 ipcMain.handle('pokestream:updates:check',()=>check());
 ipcMain.handle('pokestream:updates:download',()=>downloadUpdate());
 ipcMain.handle('pokestream:updates:install',()=>install());
 if(app.isPackaged){setTimeout(async()=>{try{const info=await check();if(info.status!=='available'||!mainWindow||mainWindow.isDestroyed())return;
 const choice=await dialog.showMessageBox(mainWindow,{type:'info',title:'Mise à jour PokeStream',message:`PokeStream ${info.version} est disponible.`,detail:'La mise à jour ne sera jamais installée pendant ton stream sans ton accord.',buttons:['Télécharger','Plus tard'],defaultId:1,cancelId:1});
 if(choice.response!==0)return;
 try{await downloadUpdate();const action=await dialog.showMessageBox(mainWindow,{type:'info',title:'Mise à jour téléchargée',message:'La nouvelle version est prête.',detail:'PokeStream doit être fermé avant de lancer l’installateur. Tes profils restent enregistrés.',buttons:['Installer maintenant','Plus tard'],defaultId:1,cancelId:1});if(action.response===0)install();}catch(e){showError(e);}
 }catch(e){/* Offline is normal and must never block startup. */}},12000);}
}
module.exports={init};
