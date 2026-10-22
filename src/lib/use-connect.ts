"use client";
import { useEffect, useMemo, useState } from "react";
import { subscribeJSON } from "./event-source";
import { effectiveScene, snapshotSchema } from "./connect";
import type { SceneData } from "./model";
export type Device={id:string;name:string;snapshot:unknown;updated_at:string|null;last_seen_at?:string|null};
export function useConnect(sceneId:string|undefined,data:SceneData,initialDevice?:Device|null){
 const [device,setDevice]=useState<Device|null>(initialDevice||null),[online,setOnline]=useState(false),[revoked,setRevoked]=useState(false);
 useEffect(()=>{if(!sceneId)return;let seen=!!initialDevice;return subscribeJSON<{device:Device|null;online:boolean}>("/api/connect/devices/events?scene="+sceneId,next=>{setDevice(next.device);setOnline(next.online);setRevoked(!next.device&&seen);if(next.device)seen=true;},()=>setOnline(false));},[sceneId,initialDevice]);
 const snapshot=useMemo(()=>snapshotSchema.safeParse(device?.snapshot),[device?.snapshot]);
 const displayed=useMemo(()=>effectiveScene(data,device?.snapshot),[data,device?.snapshot]);
 return {automatedDeaths:snapshot.success&&snapshot.data.deaths!==undefined,automatedBadges:snapshot.success&&snapshot.data.badges!==undefined,device,online,revoked,data:displayed};
}
