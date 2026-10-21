"use client";
import Image from "next/image";
import {useState} from "react";
export function UserAvatar({name="",src,color="#335ba5",size="small"}:{name?:string;src?:string;color?:string;size?:"small"|"medium"|"large"}){
 const [failed,setFailed]=useState<string|null>(null);
 return <span className={"user-avatar user-avatar-"+size} style={{backgroundColor:color}} aria-hidden="true">
  {src&&failed!==src?<Image src={src} alt="" width={192} height={192} unoptimized onError={()=>setFailed(src)}/>:<span>{name.trim().slice(0,2).toUpperCase()||"?"}</span>}
 </span>;
}
