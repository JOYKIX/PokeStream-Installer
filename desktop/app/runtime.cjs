const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
const {createRequire}=require('node:module');
async function digest(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function validate(root){
 for(const file of ['web/server.js','web/.next/BUILD_ID','engine/PokeStream Connect.exe'])if(!fs.existsSync(path.join(root,file)))throw Error('Runtime incomplete: '+file);
 // A successful web build is insufficient: the distributed server must include its own dependencies.
 const load=createRequire(path.join(root,'web','server.js'));
 for(const name of ['next','react','react-dom'])if(!load.resolve(name).startsWith(path.resolve(root)+path.sep))throw Error('Runtime dependency missing: '+name);
}
function createRuntime({resources,installDirectory,version,notify}){
 const manifestFile=path.join(installDirectory,'runtime.json');
 const archive=path.join(resources,'runtime.zip');
 const metadata=path.join(resources,'runtime.json');
 function current(){try{const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));if(manifest.version!==version||!/^runtime-[a-zA-Z0-9.-]+$/.test(manifest.directory))return null;
 const root=path.join(installDirectory,manifest.directory);validate(root);return root;}catch{return null;}}
 async function install(){
  const expected=JSON.parse(await fsp.readFile(metadata,'utf8'));
  if(expected.version!==version||!Number.isSafeInteger(expected.size)||expected.size<1||!/^[a-f0-9]{64}$/.test(expected.sha256))throw Error('Invalid bundled runtime manifest.');
  notify({phase:'verifying',progress:null,error:''});
  const stat=await fsp.stat(archive);
  if(stat.size!==expected.size||await digest(archive)!==expected.sha256)throw Error('The bundled application is damaged. Download PokeStream again.');
  await fsp.mkdir(installDirectory,{recursive:true});
  const directory='runtime-'+version+'-'+randomUUID(),destination=path.join(installDirectory,directory);
  await fsp.mkdir(destination);
  notify({phase:'installing',progress:0});
  try{
   await new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(resources,'launcher','runtime-install.ps1'),'-ArchivePath',archive,'-TargetDirectory',destination],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let pending='',errors='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines){try{const p=JSON.parse(line);if(Number.isFinite(p.progress))notify({progress:Math.min(99,p.progress)});}catch{}}});
    child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-4000);});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(errors||'Runtime extraction failed.')));
   });
   validate(destination);
   const temp=manifestFile+'.tmp';await fsp.writeFile(temp,JSON.stringify({version,directory,sha256:expected.sha256}));await fsp.rename(temp,manifestFile);
   notify({phase:'ready',installed:true,progress:100});return destination;
  }catch(error){
   // Only the newly allocated, validated child path may be removed after an interrupted installation.
   if(path.dirname(destination)===path.resolve(installDirectory)&&path.basename(destination)===directory)await fsp.rm(destination,{recursive:true,force:true}).catch(()=>{});
   throw error;
  }
 }
 return {current,install};
}
module.exports={createRuntime,digest,validate};
