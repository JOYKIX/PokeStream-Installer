import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
// A cache hit is valid only when both the inputs and every staged output match.
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function filesAt(root){
 if(!fs.existsSync(root))return [];
 return fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{
  if(e.isSymbolicLink())throw Error('Build input contains a symbolic link: '+e.name);
  const file=path.join(root,e.name);return e.isDirectory()?filesAt(file):e.isFile()?[file]:[];
 });
}
export function fingerprint(root,paths,extra=''){
 const hash=createHash('sha256').update(extra);
 for(const name of [...new Set(paths)].sort()){
  const absolute=path.resolve(root,name);
  if(!fs.existsSync(absolute)){hash.update(name+'\0missing\0');continue;}
  for(const file of fs.statSync(absolute).isDirectory()?filesAt(absolute):[absolute]){
   hash.update(path.relative(root,file).split(path.sep).join('/')+'\0').update(fs.readFileSync(file));
  }
 }return hash.digest('hex');
}
export function sourceFiles(root,prefix){
 // Untracked source edits count too; ignored build output never does.
 const output=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--',prefix],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
 return output.split('\0').filter(Boolean).filter(f=>!/(^|\/)(bin|obj|dist|node_modules|\.artifacts)\//.test(f));
}
export function componentCache(root){
 const directory=path.join(root,'.artifacts/components');fs.mkdirSync(directory,{recursive:true});
 return async function cached(name,input,build,{force=false}={}){
  if(!/^[a-z-]+$/.test(name))throw Error('Invalid component');
  const target=path.join(directory,name),record=path.join(directory,name+'.json');
  let previous;try{previous=JSON.parse(fs.readFileSync(record,'utf8'));}catch{}
  const outputHash=()=>fingerprint(target,['.']);
  if(!force&&previous?.input===input&&fs.existsSync(target)&&previous.output===outputHash()){
   console.log('[PokeStream] '+name+': unchanged, reusing verified build.');return {directory:target,revision:input,reused:true};
  }
  const stage=path.join(directory,name+'.stage');
  if(path.dirname(stage)!==directory)throw Error('Invalid staging directory');
  fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
  await build(stage);
  // Replace only after the new component has completed successfully.
  fs.rmSync(target,{recursive:true,force:true});fs.renameSync(stage,target);
  fs.writeFileSync(record,JSON.stringify({input,output:outputHash(),builtAt:new Date().toISOString()}));
  return {directory:target,revision:input,reused:false};
 };
}
