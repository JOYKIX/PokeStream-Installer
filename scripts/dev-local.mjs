import {spawn} from "node:child_process";
const child=spawn(process.platform==="win32"?"npm.cmd":"npm",["run","dev"],{stdio:"inherit",env:{...process.env,POKESTREAM_LOCAL:"1",POKESTREAM_DATA_DIR:process.env.POKESTREAM_DATA_DIR||"",HOSTNAME:"127.0.0.1"}});
child.on("exit",code=>process.exit(code??1));
process.on("SIGINT",()=>child.kill("SIGINT"));
process.on("SIGTERM",()=>child.kill("SIGTERM"));
