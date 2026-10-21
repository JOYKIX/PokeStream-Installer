"use client";
import {useI18n} from "@/i18n/client";
import {LanguageSwitcher} from "./language-switcher";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {LayoutGrid,Cable,Palette,PanelsTopLeft,Settings,GitFork,AppWindow,Users} from "lucide-react";
import {useEffect,useRef} from "react";
import {Brand} from "./ui";
import {UserAvatar} from "./user-avatar";
import type {Grade} from "@/lib/access";
const destinations=[["/studio","Adventure",LayoutGrid],["/connect","Connect",Cable],["/theme-creator","Theme Creator",Palette],["/builder","Overlay Builder",PanelsTopLeft]]as const;
export function SiteHeader({local=false,userName,avatar,color}:{local?:boolean;userName?:string|null;avatar?:string;color?:string;grade?:Grade;accountPending?:boolean}){
 const {t}=useI18n(),path=usePathname(),ref=useRef<HTMLElement>(null),choosing=path==="/users";
 useEffect(()=>{const node=ref.current;if(!node)return;const update=()=>document.documentElement.style.setProperty("--site-header-height",(node.offsetHeight+(document.querySelector(".desktop-window-bar")?.clientHeight||0))+"px");const observer=new ResizeObserver(update);observer.observe(node);update();return()=>observer.disconnect();},[]);
 return <header className="site-header" ref={ref}><div className="site-header-inner"><Brand/>
  {local&&userName&&!choosing?<nav aria-label={t("Navigation principale")} className="site-nav">{destinations.map(([url,label,Icon])=><Link key={url} href={url} aria-current={path.startsWith(url)?"page":undefined}><Icon size={17}/><span>{t(label)}</span></Link>)}</nav>:<span className="header-spacer"/>}
  <div className="site-account"><LanguageSwitcher compact/>
   {local&&<button className="icon-button desktop-launcher-button" title={t("Ouvrir le launcher")} aria-label={t("Ouvrir le launcher")} onClick={()=>{const api=(window as Window&{pokeStream?:{openLauncher?:()=>Promise<void>}}).pokeStream;void api?.openLauncher?.();}}><AppWindow size={18}/></button>}
   {local?<>{userName&&!choosing&&<Link className="icon-button" href="/settings" aria-current={path==="/settings"?"page":undefined} title={t("Réglages")} aria-label={t("Réglages")}><Settings size={18}/></Link>}
    <Link className="local-account" href="/users" aria-current={choosing?"page":undefined} title={t("Changer de profil")} aria-label={userName?t("Changer de profil")+" · "+userName:t("Profils locaux")}>
     {userName?<UserAvatar name={userName} src={avatar} color={color}/>:<Users size={19}/>}<span className="local-account-name">{choosing?t("Profils locaux"):userName||t("Profils locaux")}</span>
    </Link></>:<a className="button secondary compact" href="https://github.com/JOYKIX/PokeStream-Installer" target="_blank" rel="noreferrer"><GitFork size={16}/>{t("Code source")}</a>}
  </div></div></header>;
}
export function SiteFooter(){const {t}=useI18n();return <footer className="site-footer"><span>PokeStream</span><Link href="/privacy">{t("Confidentialité")}</Link><a href="https://github.com/JOYKIX/PokeStream-Installer" target="_blank" rel="noreferrer">{t("Code source")}</a></footer>;}
