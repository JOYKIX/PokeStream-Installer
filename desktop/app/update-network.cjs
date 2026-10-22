const https=require('node:https');
const ALLOWED=new Set(['api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com']);
function approved(value){const u=new URL(value);if(u.protocol!=='https:'||!ALLOWED.has(u.hostname)||u.username||u.password||u.port)throw Error('Update address rejected.');return u;}
function request(value,{headers={},status=200,timeout=45000}={},redirects=5){
 return new Promise((resolve,reject)=>{
  if(redirects<0)return reject(Error('Too many update redirects.'));
  let url;try{url=approved(value);}catch(e){return reject(e);}
  const req=https.get(url,{headers:{'User-Agent':'PokeStream-Launcher','Accept':'application/vnd.github+json',...headers}},response=>{
   if([301,302,303,307,308].includes(response.statusCode)){response.resume();try{resolve(request(new URL(response.headers.location,url).href,{headers,status,timeout},redirects-1));}catch(e){reject(e);}return;}
   if(response.statusCode!==status){response.destroy();return reject(Error('Update HTTP '+response.statusCode));}resolve(response);
  });req.setTimeout(timeout,()=>req.destroy(Error('Update server unavailable.')));req.on('error',reject);
 });
}
async function bytes(url,max,options){
 let last;
 for(let attempt=0;attempt<(options?.attempts??3);attempt++)try{
  const response=await request(url,options),chunks=[];let length=0;
  for await(const chunk of response){length+=chunk.length;if(length>max){response.destroy();throw Error('Update response too large.');}chunks.push(chunk);}return {data:Buffer.concat(chunks),headers:response.headers};
 }catch(e){last=e;if(/HTTP (400|401|403|404)/.test(e.message))break;await new Promise(r=>setTimeout(r,350*(attempt+1)));}
 throw last;
}
module.exports={bytes,request,approved};
