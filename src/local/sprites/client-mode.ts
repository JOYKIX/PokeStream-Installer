"use client";
import {useSyncExternalStore} from "react";
let revision="initial",timer:ReturnType<typeof setInterval>|undefined,pending:Promise<void>|null=null;
const listeners=new Set<()=>void>();
export function refreshSpriteImages(){
 if(pending)return pending;
 pending=fetch("/api/local/sprites?view=mode",{cache:"no-store"}).then(async r=>{
  if(!r.ok)return;const data=await r.json(),value=data.mode+":"+data.revision;
  if(value!==revision){revision=value;for(const listener of listeners)listener();}
 }).catch(()=>{}).finally(()=>{pending=null;});return pending;
}
function subscribe(listener:()=>void){
 listeners.add(listener);
 if(listeners.size===1){void refreshSpriteImages();timer=setInterval(()=>void refreshSpriteImages(),10000);}
 return()=>{listeners.delete(listener);if(!listeners.size){clearInterval(timer);timer=undefined;}};
}
export const useSpriteRevision=()=>useSyncExternalStore(subscribe,()=>revision,()=>"initial");
