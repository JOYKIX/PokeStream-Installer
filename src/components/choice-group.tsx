"use client";
import {useI18n} from "@/i18n/client";
import type {ReactNode,KeyboardEvent} from "react";
export type Choice<T extends string>={value:T;label:ReactNode;disabled?:boolean;title?:string};
export function ChoiceGroup<T extends string>({id,label,value,options,onChange,columns,className="",disabled=false}:{
 id?:string;label:string;value:T;options:readonly Choice<T>[];onChange:(value:T)=>void;columns?:2|3|4|6;className?:string;disabled?:boolean;
}){
 const selected=options.some(option=>option.value===value&&!option.disabled)?value:options.find(option=>!option.disabled)?.value;
 function navigate(event:KeyboardEvent<HTMLDivElement>){
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key))return;
  const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if(!buttons.length)return;event.preventDefault();
  const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
  const index=event.key==="Home"?0:event.key==="End"?buttons.length-1:(current+(event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1)+buttons.length)%buttons.length;
  buttons[index].focus({preventScroll:true});buttons[index].click();
 }
 return <div id={id} className={"choice-group "+className} role="radiogroup" aria-label={label} data-columns={columns} onKeyDown={navigate}>
  {options.map(option=><button key={option.value} type="button" role="radio" aria-checked={option.value===value} tabIndex={option.value===selected?0:-1} title={option.title} disabled={disabled||option.disabled} onClick={()=>onChange(option.value)}>{option.label}</button>)}
 </div>;
}
export function TeamLayoutChoices({value,onChange,disabled=false}:{value:"6x1"|"3x2"|"2x3"|"1x6";onChange:(value:"6x1"|"3x2"|"2x3"|"1x6")=>void;disabled?:boolean}){
 const {t}=useI18n();
 return <ChoiceGroup label={t("Disposition de l’équipe")} value={value} onChange={onChange} disabled={disabled} columns={4} className="layout-choices" options={(["6x1","3x2","2x3","1x6"]as const).map(layout=>({value:layout,label:<><span className="layout-mini" aria-hidden="true" style={{gridTemplateColumns:"repeat("+layout.split("x")[0]+",1fr)"}}>{Array.from({length:6},(_,i)=><i key={i}/>)}</span><span>{layout.replace("x"," × ")}</span></>}))}/>;
}
