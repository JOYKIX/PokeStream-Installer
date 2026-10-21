import "server-only";
import path from "node:path";
import { readFile,writeFile,mkdir,rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dataDirectory } from "./store";
export function ipcDirectory(){return process.env.POKESTREAM_IPC_DIR||path.join(dataDirectory(),"engine");}
export async function engineStatus(){try {const file=JSON.parse(await readFile(path.join(ipcDirectory(),"status.json"),"utf8"));return {...file,available:Date.now()-Date.parse(file.updatedAt)<15000};}catch{return {available:false,paused:false,emulators:[],activity:[],reading:"En attente",game:"Aucun jeu détecté",ryujinxPort:0,citronPort:0};}}
export async function engineCommand(command:{action:string;value?:unknown}){
 await mkdir(ipcDirectory(),{recursive:true});const id=randomUUID(),filename=path.join(ipcDirectory(),"command.json"),temp=filename+"."+id;
 await writeFile(temp,JSON.stringify({id,...command}));await rename(temp,filename);return id;
}
