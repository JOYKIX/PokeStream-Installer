const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function acquireOperation(directory,{purpose='update',timeout=30000}={}){
 await fs.mkdir(directory,{recursive:true});
 const file=path.join(path.dirname(directory),'installation-operation.json'),token=randomUUID(),deadline=Date.now()+timeout;
 while(true){
  try{await fs.writeFile(file,JSON.stringify({pid:process.pid,token,purpose}),{flag:'wx'});break;}
  catch(error){if(error.code!=='EEXIST')throw error;}
  try{const owner=JSON.parse(await fs.readFile(file,'utf8'));let alive=false;
   if(Number.isSafeInteger(owner.pid)&&owner.pid>0)try{process.kill(owner.pid,0);alive=true;}catch(error){alive=error.code==='EPERM';}
   if(!alive){await fs.unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});continue;}
  }catch(error){if(error.code==='ENOENT')continue;if(!(error instanceof SyntaxError))throw error;
   // A competing process may still be writing its new lock.
   const stat=await fs.stat(file).catch(()=>null);if(stat&&Date.now()-stat.mtimeMs>30000)await fs.unlink(file).catch(()=>{});
  }
  if(Date.now()>=deadline)throw Error('Another PokeStream installation operation is running. Retry when it finishes.');
  await delay(150);
 }
 const release=async()=>{try{const owner=JSON.parse(await fs.readFile(file,'utf8'));if(owner.token===token)await fs.unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}};
 release.transfer=async pid=>{if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid maintenance owner.');const owner=JSON.parse(await fs.readFile(file,'utf8'));if(owner.token!==token)throw Error('Installation ownership changed.');const temp=file+'.'+token+'.tmp';await fs.writeFile(temp,JSON.stringify({...owner,pid}));await fs.rename(temp,file);};
 // Launchers before 1.1.1 used a lock inside Updates. Respect an active old owner.
 try{while(true){let owner;try{owner=JSON.parse(await fs.readFile(path.join(directory,'operation.json'),'utf8'));}catch{break;}let alive=false;if(Number.isSafeInteger(owner.pid)&&owner.pid>0)try{process.kill(owner.pid,0);alive=true;}catch(error){alive=error.code==='EPERM';}if(!alive)break;if(Date.now()>=deadline)throw Error('Another PokeStream update is running. Retry when it finishes.');await delay(150);}}catch(error){await release();throw error;}
 return release;
}
module.exports={acquireOperation};
