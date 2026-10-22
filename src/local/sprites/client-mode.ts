"use client";
import {useSyncExternalStore} from "react";
import {subscribeJSON} from "@/lib/event-source";
let revision="initial",stop:(()=>void)|undefined,pending:Promise<void>|null=null;
const listeners=new Set<()=>void>();
function update(data:{mode:string;revision:string}){const value=data.mode+":"+data.revision;if(value!==revision){revision=value;for(const listener of listeners)listener();}}
export function refreshSpriteImages(){if(pending)return pending;pending=fetch("/api/local/sprites?view=mode",{cache:"no-store"}).then(async r=>{if(r.ok)update(await r.json());}).catch(()=>{}).finally(()=>{pending=null;});return pending;}
function subscribe(listener:()=>void){listeners.add(listener);if(listeners.size===1)stop=subscribeJSON<{mode:string;revision:string}>("/api/local/sprites/events",update);return()=>{listeners.delete(listener);if(!listeners.size){stop?.();stop=undefined;}};}
export const useSpriteRevision=()=>useSyncExternalStore(subscribe,()=>revision,()=>"initial");
