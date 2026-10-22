const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function acquireOperation(directory,{purpose='update',timeout=30000}={}){
 await fs.mkdir(directory,{recursive:true});
 const file=path.join(directory,'operation.json'),token=randomUUID(),deadline=Date.now()+timeout;
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
 return async()=>{try{const owner=JSON.parse(await fs.readFile(file,'utf8'));if(owner.token===token)await fs.unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}};
}
module.exports={acquireOperation};
