"use client";
import { readLocalPreference } from "@/lib/legacy-storage";
import { useEffect,useState } from "react";
import { sceneSchema,type SceneData } from "@/lib/model";
import { DEMO_STORAGE,demoScene } from "@/lib/demo";
import { subscribeJSON } from "@/lib/event-source";
import { OverlayStage } from "./overlay-stage";
export function LiveOverlay({token,part}:{token:string;part:string}){
 const [data,setData]=useState<SceneData|null>(null);
 useEffect(()=>{
  if(token==="demo"){
   const refresh=()=>{try{const parsed=sceneSchema.safeParse(JSON.parse(readLocalPreference(DEMO_STORAGE)||"null"));setData(parsed.success?parsed.data:demoScene());}catch{setData(demoScene());}};
   refresh();window.addEventListener("storage",refresh);window.addEventListener("pokestream-demo-change",refresh);return()=>{window.removeEventListener("storage",refresh);window.removeEventListener("pokestream-demo-change",refresh);};
  }
  return subscribeJSON<{data:unknown}|null>("/api/overlay/"+token+"/events",payload=>{if(!payload){setData(null);return;}const parsed=sceneSchema.safeParse(payload.data);if(parsed.success)setData(parsed.data);});
 },[token]);
 return <div className="obs-output">{data&&<OverlayStage viewport data={data} part={part}/>}</div>;
}
