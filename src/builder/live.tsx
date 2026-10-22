"use client";
import {useEffect,useState} from "react";
import type {SceneData} from "@/lib/model";
import {subscribeJSON} from "@/lib/event-source";
import {builderSchema,type BuilderData} from "./schema";
import {BuilderCanvas,type DisplayTheme} from "./render";
type Payload={data:BuilderData;scene:SceneData|null;themes:DisplayTheme[]};
export function BuilderLive({token}:{token:string}){
 const [payload,setPayload]=useState<Payload|null>(null);
 useEffect(()=>subscribeJSON<Payload|null>("/api/builder/obs/"+token+"/events",next=>{if(!next){setPayload(null);return;}const parsed=builderSchema.safeParse(next.data);if(parsed.success)setPayload({...next,data:parsed.data});}),[token]);
 return <div className="obs-output">{payload&&<BuilderCanvas data={payload.data} scene={payload.scene} themes={payload.themes} token={token}/>}</div>;
}
