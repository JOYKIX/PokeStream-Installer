"use client";
import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { TYPE_LABELS } from "@/lib/model";
import { typeBadgeSource } from "@/lib/type-badges";
import { useI18n } from "@/i18n/client";
import { useSpriteRevision } from "@/local/sprites/client-mode";
export function TypeBadge({type,style="text",reserved=false}:{type:string;style?:string;reserved?:boolean}) {
  const {t}=useI18n(),revision=useSpriteRevision(),source=typeBadgeSource(type,style);
  const key=source?.url+":"+revision,[failed,setFailed]=useState("");
  if(!source||failed===key)return <span className={"type-pill type-"+type}>{t(TYPE_LABELS[type])}</span>;
  const css={"--type-badge-width":source.compact?"24px":"72px"} as CSSProperties;
  return <span className="game-type-badge" style={css}>
    {reserved?<span className="game-type-image"/>:<Image src={source.url+"?render="+encodeURIComponent(revision)} className={"game-type-image"+(source.pixelated?" pixel-sprite":"")} width={source.compact?24:72} height={24} alt={t(TYPE_LABELS[type])} title={t(TYPE_LABELS[type])} unoptimized onError={()=>setFailed(key)}/>}
  </span>;
}
