import type { Locale } from "@/i18n/config";
export function LanguageFlag({ locale }: { locale: Locale }) {
 return <svg className="language-flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
  {locale==="fr"?<><path fill="#fff" d="M0 0h60v40H0z"/><path fill="#002654" d="M0 0h20v40H0z"/><path fill="#ed2939" d="M40 0h20v40H40z"/></>:
   locale==="ja"?<><path fill="#fff" d="M0 0h60v40H0z"/><circle cx="30" cy="20" r="12" fill="#bc002d"/></>:
   locale==="de"?<><path fill="#ffce00" d="M0 0h60v40H0z"/><path fill="#000" d="M0 0h60v13.333H0z"/><path fill="#d00" d="M0 13.333h60v13.334H0z"/></>:
   locale==="es"?<><path fill="#aa151b" d="M0 0h60v40H0z"/><path fill="#f1bf00" d="M0 10h60v20H0z"/><path fill="#aa151b" d="M17 16h9v9l-4.5 3-4.5-3z"/><path fill="#f4e8c1" d="M18 17h3v4h-3zm4 0h3v4h-3zm-4 5h3v3h-3zm4 0h3v3h-3z"/></>:
   locale==="it"?<><path fill="#fff" d="M0 0h60v40H0z"/><path fill="#009246" d="M0 0h20v40H0z"/><path fill="#ce2b37" d="M40 0h20v40H40z"/></>:
   locale==="pt-BR"?<><path fill="#009b3a" d="M0 0h60v40H0z"/><path fill="#ffdf00" d="M30 5 54 20 30 35 6 20z"/><circle cx="30" cy="20" r="10" fill="#002776"/><path d="M20 19q12-5 20 4" fill="none" stroke="#fff" strokeWidth="2"/></>:
   locale==="ko"?<><path fill="#fff" d="M0 0h60v40H0z"/><path fill="#cd2e3a" d="M20 20a10 10 0 0 1 20 0c0 6-10 6-10 0a5 5 0 0 0-10 0"/><path fill="#0047a0" d="M40 20a10 10 0 0 1-20 0c0-6 10-6 10 0a5 5 0 0 0 10 0"/><path stroke="#111" strokeWidth="2.4" d="m10 9 8 6m-6-9 8 6m23 13 8 6m-6-9 8 6"/></>:
   locale==="zh-CN"?<><path fill="#de2910" d="M0 0h60v40H0z"/><path fill="#ffde00" d="m12 6 2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"/><circle cx="24" cy="7" r="2" fill="#ffde00"/><circle cx="30" cy="13" r="2" fill="#ffde00"/><circle cx="30" cy="22" r="2" fill="#ffde00"/></>:
   locale==="zh-TW"?<><path fill="#fe0000" d="M0 0h60v40H0z"/><path fill="#000095" d="M0 0h30v21H0z"/><circle cx="15" cy="10.5" r="7.5" fill="#fff"/><circle cx="15" cy="10.5" r="4.5" fill="#000095"/><circle cx="15" cy="10.5" r="3.5" fill="#fff"/></>:
   <><path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40"/><path stroke="#c8102e" strokeWidth="4" d="m0 0 60 40M60 0 0 40"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/><path stroke="#c8102e" strokeWidth="8" d="M30 0v40M0 20h60"/></>}
 </svg>;
}
