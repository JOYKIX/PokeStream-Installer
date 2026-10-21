// The launcher and workspace have independent Electron processes and userData.
// A local pipe lets the launcher focus/close its workspace without killing
// emulators, guessing process names, or hosting the app inside the launcher.
const fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
const {randomBytes,randomUUID}=require('node:crypto');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function createWorkspaceControl({dataDir,version,onCommand}){
 const file=path.join(dataDir,'workspace.json');let server,record;
 async function start(){
  record={pid:process.pid,version,pipe:'PokeStream-workspace-'+randomUUID(),token:randomBytes(32).toString('hex')};
  server=net.createServer(socket=>{
   let buffer='';socket.setEncoding('utf8');socket.setTimeout(15000,()=>socket.destroy());
   socket.on('data',chunk=>{buffer+=chunk;if(buffer.length>4096)return socket.destroy();if(!buffer.includes('\n'))return;
    socket.pause();let input;try{input=JSON.parse(buffer.split('\n')[0]);}catch{return socket.destroy();}
    if(input.token!==record.token||!['focus','close','language'].includes(input.action))return socket.destroy();
    Promise.resolve().then(()=>onCommand(input.action,input.value)).then(value=>socket.end(JSON.stringify({ok:true,value})+'\n'),error=>socket.end(JSON.stringify({ok:false,error:error.message})+'\n'));
   });socket.on('error',()=>{});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen('\\\\.\\pipe\\'+record.pipe,resolve);});
  const temp=file+'.'+process.pid;await fs.writeFile(temp,JSON.stringify(record));await fs.rename(temp,file);
 }
 async function close(){server?.close();try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.token===record?.token)await fs.rm(file,{force:true});}catch{}}
 return {start,close};
}
async function workspaceRecord(dataDir){
 try{const r=JSON.parse(await fs.readFile(path.join(dataDir,'workspace.json'),'utf8'));if(!Number.isInteger(r.pid)||!/^PokeStream-workspace-[a-f0-9-]{36}$/.test(r.pipe)||!/^[a-f0-9]{64}$/.test(r.token))return null;process.kill(r.pid,0);return r;}catch{return null;}
}
async function workspaceCommand(dataDir,action,value){
 const record=await workspaceRecord(dataDir);if(!record)return null;
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection('\\\\.\\pipe\\'+record.pipe);let data='';
  socket.setEncoding('utf8');socket.setTimeout(20000,()=>socket.destroy(Error('PokeStream did not respond.')));
  socket.once('error',reject);socket.once('connect',()=>socket.write(JSON.stringify({token:record.token,action,value})+'\n'));
  socket.on('data',chunk=>{data+=chunk;if(data.length>4096)socket.destroy(Error('Invalid workspace response.'));});
  socket.once('end',()=>{try{const response=JSON.parse(data);if(!response.ok)throw Error(response.error);resolve(response.value);}catch(error){reject(error);}});
 });
}
async function stopWorkspace(dataDir){
 const record=await workspaceRecord(dataDir);if(!record)return;
 await workspaceCommand(dataDir,'close');
 for(let i=0;i<200;i++){try{process.kill(record.pid,0);}catch{return;}await delay(100);}
 throw Error('PokeStream is still closing. No application files were changed.');
}
module.exports={createWorkspaceControl,workspaceRecord,workspaceCommand,stopWorkspace};
