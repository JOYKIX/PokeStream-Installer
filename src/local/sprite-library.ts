import "server-only";
import {spriteService} from "./sprites/service";
export const SPRITE_COLLECTIONS=["pokemon","items","types","badges"]as const;
export type SpriteCollection=(typeof SPRITE_COLLECTIONS)[number];
export function isSpriteCollection(value:string):value is SpriteCollection{return SPRITE_COLLECTIONS.some(c=>c===value);}
export function spritePath(parts:string[]){if(!parts.length||parts.length>12||parts.some(p=>!p||p==="."||p===".."||!/^[a-zA-Z0-9_.-]{1,110}$/.test(p)))return null;const file=parts.join("/");return file.length<360&&/\.(png|gif|svg|webp)$/i.test(file)?file:null;}
export async function sprite(file:string,collection:SpriteCollection="pokemon",localOnly=false){if(!isSpriteCollection(collection)||!spritePath(file.split("/")))return null;const service=await spriteService().init(),entry=service.catalog!.byPath.get(collection+"/"+file);return entry?service.resolveFile(entry,localOnly):null;}
