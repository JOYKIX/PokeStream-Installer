const {decode,REPOSITORY}=require('./update-format.cjs');
const {bytes}=require('./update-network.cjs');
const root='https://github.com/'+REPOSITORY+'/releases/';
const version=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value);
async function pair(base,expected){
 const stamp=Date.now(),options={headers:{'Cache-Control':'no-cache'}};
 const [content,signature]=await Promise.all([
  bytes(base+'update.json.gz?check='+stamp,16*1024*1024,options),
  bytes(base+'update.sig?check='+stamp,512,options)
 ]);
 const manifest=decode(content.data,signature.data.toString('utf8'));
 if(expected&&manifest.version!==expected)throw Error('Update version mismatch.');
 return {content:content.data,signature:signature.data.toString('utf8'),manifest};
}
async function releaseNotes(manifest){
 try{
  const response=await bytes(root+'download/v'+manifest.version+'/release-notes.json',128*1024,{timeout:5000,attempts:1});
  const notes=JSON.parse(response.data),locales={};
  if(notes.version!==manifest.version||!notes.locales)throw Error('Unexpected release notes.');
  for(const [locale,value] of Object.entries(notes.locales).slice(0,20)){
   if(!Array.isArray(value?.sections))continue;
   locales[locale]={sections:value.sections.slice(0,12).filter(s=>typeof s?.title==='string'&&Array.isArray(s.items)).map(s=>({title:s.title.slice(0,160),items:s.items.filter(i=>typeof i==='string').slice(0,30).map(i=>i.slice(0,1600))}))};
  }
  return {version:manifest.version,date:String(manifest.createdAt||'').slice(0,10),locales};
 }catch{return {version:manifest.version,date:String(manifest.createdAt||'').slice(0,10)};}
}
async function readRelease(requested){
 if(requested&&!version(requested))throw Error('Invalid requested version.');
 let failure;
 // Public assets avoid GitHub API quotas and stale release lists during publication.
 // Retry the signed pair once if a release changes between the two requests.
 for(let attempt=0;attempt<2;attempt++)try{
  const result=await pair(root+(requested?'download/v'+requested+'/':'latest/download/'),requested);
  return {...result,notes:await releaseNotes(result.manifest)};
 }catch(error){failure=error;}
 // Older distributions and temporary asset redirects retain an independent fallback.
 try{
  const endpoint='https://api.github.com/repos/'+REPOSITORY+'/releases'+(requested?'/tags/v'+requested:'?per_page=20&check='+Date.now());
  const data=JSON.parse((await bytes(endpoint,2*1024*1024,{headers:{'Cache-Control':'no-cache'}})).data);
  const candidates=(Array.isArray(data)?data:[data]).filter(r=>!r.draft&&!r.prerelease&&version(String(r.tag_name).replace(/^v/,''))).sort((a,b)=>b.tag_name.slice(1).localeCompare(a.tag_name.slice(1),'en',{numeric:true}));
  for(const remote of candidates){
   if(!remote.assets?.some(a=>a.name==='update.json.gz')||!remote.assets?.some(a=>a.name==='update.sig'))continue;
   try{
    const result=await pair(root+'download/'+remote.tag_name+'/',remote.tag_name.slice(1));
    if(requested&&result.manifest.version!==requested)throw Error('Update version mismatch.');
    return {...result,notes:{version:result.manifest.version,date:String(remote.published_at||'').slice(0,10),body:String(remote.body||'').slice(0,16000)}};
   }catch(error){failure=error;}
  }
 }catch(error){throw Error((failure?.message||'Updates unavailable.')+'; GitHub API: '+error.message);}
 throw failure||Error('No authenticated PokeStream update is available.');
}
module.exports={readRelease};
