"use client";
import {useState} from "react";
import {Gamepad2,ChevronDown,Search,Check} from "lucide-react";
import {useI18n} from "@/i18n/client";
import {GAMES} from "@/lib/games";
import {normalizeSearch,type SceneData} from "@/lib/model";
import {Modal} from "./ui";
export function GamePicker({value,onChange,disabled=false}:{value:SceneData["game"];onChange:(value:SceneData["game"])=>void;disabled?:boolean}){
 const {t}=useI18n(),[open,setOpen]=useState(false),[query,setQuery]=useState("");
 const search=normalizeSearch(query),games=Object.entries(GAMES).filter(([,game])=>normalizeSearch(t(game.label)+" "+game.region).includes(search));
 return <><button type="button" className="game-picker-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={t("Jeu")+" · "+t(GAMES[value].label)} onClick={()=>{setQuery("");setOpen(true);}}><Gamepad2 size={18}/><span>{t(GAMES[value].label)}</span><ChevronDown size={14}/></button>
 <Modal open={open} onOpenChange={setOpen} title={t("Choisir un jeu")} wide><div className="app-search"><Search size={16}/><input type="search" autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("Rechercher un jeu…")} aria-label={t("Rechercher un jeu…")}/></div>
  <div className="game-picker-grid">{games.map(([id,game])=><button type="button" key={id} aria-pressed={id===value} onClick={()=>{onChange(id as SceneData["game"]);setOpen(false);}}><Gamepad2 size={21}/><span><strong>{t(game.label)}</strong><small>{t(game.region)} · {game.badges.length} {t("badges")}</small></span>{id===value&&<Check size={17}/>}</button>)}</div>
  {!games.length&&<p className="app-no-results">{t("Aucun résultat.")}</p>}
 </Modal></>;
}
