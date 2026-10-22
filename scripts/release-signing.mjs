import fs from 'node:fs';
import path from 'node:path';
import {generateKeyPairSync,createPublicKey,sign,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),publicFile=path.join(root,'desktop/app/update-key.json');
const protectedFile=path.join(process.env.LOCALAPPDATA||process.env.TEMP||'.','PokeStream-Publisher','release-signing.dpapi');
function protect(input,decrypt=false){
 if(process.platform!=='win32')throw Error('Set POKESTREAM_SIGNING_KEY to an Ed25519 PEM for this publisher.');
 const script="Add-Type -AssemblyName System.Security; $v=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::"+(decrypt?'Unprotect':'Protect')+"($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))";
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:input.toString('base64'),encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw Error('The release signing key could not be opened.');
 return Buffer.from(result.stdout.trim(),'base64');
}
export function initializeKey(){
 if(fs.existsSync(publicFile)){
  if(!process.env.POKESTREAM_SIGNING_KEY&&!fs.existsSync(protectedFile))throw Error('Signing key missing. Restore the publisher key; never silently replace the trusted public key.');
  return;
 }
 if(process.env.POKESTREAM_SIGNING_KEY)throw Error('Initialize the public key explicitly before publishing.');
 const pair=generateKeyPairSync('ed25519',{publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const encrypted=protect(Buffer.from(pair.privateKey));
 fs.mkdirSync(path.dirname(protectedFile),{recursive:true});fs.writeFileSync(protectedFile,encrypted,{flag:'wx'});
 const id=createHash('sha256').update(pair.publicKey).digest('hex').slice(0,16);
 fs.writeFileSync(publicFile,JSON.stringify({id,publicKey:pair.publicKey},null,2)+'\n');
}
export function signRelease(buffer){
 const privateKey=process.env.POKESTREAM_SIGNING_KEY||protect(fs.readFileSync(protectedFile),true).toString();
 const trusted=JSON.parse(fs.readFileSync(publicFile,'utf8')),actual=createPublicKey(privateKey).export({type:'spki',format:'pem'});
 if(actual!==trusted.publicKey)throw Error('The private key does not match the trusted PokeStream update key.');
 return sign(null,buffer,privateKey).toString('base64');
}
if(process.argv.includes('--init')){initializeKey();console.log('Publisher signing key ready; private key protected for the current Windows user.');}
