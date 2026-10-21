import {prepareLauncher} from './prepare-launcher.mjs';
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {randomBytes,randomUUID} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
prepareLauncher();
const require=createRequire(import.meta.url);
const electron=require("electron");
const origin="http://127.0.0.1:47653";
const env={...process.env,POKESTREAM_LOCAL:"1",POKESTREAM_DEV_DESKTOP:"1",POKESTREAM_ENGINE_TOKEN:randomBytes(32).toString("hex"),POKESTREAM_ENGINE_ID:randomUUID(),POKESTREAM_INSTANCE:randomUUID()};
const frontend=spawn(process.platform==="win32"?"npm.cmd":"npm",["run","dev","--","--hostname","127.0.0.1","--port","47653"],{stdio:"inherit",env,shell:process.platform==="win32"});
async function cleanup(code){frontend.kill();process.exit(code);}
let ready=false;
for(let n=0;n<180;n++){
 if(frontend.exitCode!==null)break;
 try{const r=await fetch(origin+"/api/local/health",{signal:AbortSignal.timeout(700)});if(r.ok){const health=await r.json();if(health.instance===env.POKESTREAM_INSTANCE){ready=true;break;}
    console.error("Le port 47653 est déjà utilisé par un autre serveur. Ferme cet ancien processus PokeStream.");await cleanup(1);}}catch{}
 await sleep(550);
}
if(!ready){console.error("Serveur local indisponible. Vérifie le port 47653.");await cleanup(1);}
const ui=spawn(electron,["."],{stdio:"inherit",env});
ui.on("exit",code=>void cleanup(code??1));
process.on("SIGINT",()=>void cleanup(0));
process.on("SIGTERM",()=>void cleanup(0));
