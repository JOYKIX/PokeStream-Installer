export const locales = ["en", "fr", "ja", "es", "de", "pt-BR", "it", "ko", "zh-CN", "zh-TW"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "pokestream-language";
export const localeNames: Record<Locale,string> = {en:"English",fr:"Français",ja:"日本語",es:"Español",de:"Deutsch","pt-BR":"Português (Brasil)",it:"Italiano",ko:"한국어","zh-CN":"简体中文","zh-TW":"繁體中文"};
export function isLocale(value:unknown):value is Locale {return typeof value==="string"&&locales.includes(value as Locale);}
export function resolveLocale(tag:string):Locale|null {
 const value=tag.toLowerCase().replace(/_/g,"-");
 if(value==="pt"||value.startsWith("pt-"))return "pt-BR";
 if(value==="zh"||value.startsWith("zh-")){
  return /(?:^|[-])(tw|hk|mo|hant)(?:[-]|$)/.test(value)?"zh-TW":"zh-CN";
 }
 const language=value.split("-")[0];
 return locales.find(code=>code.toLowerCase()===language)??null;
}
export function detectLocale(header:string|null|undefined):Locale {
 const choices=(header??"").split(",").map((part,index)=>{
  const [tag,...options]=part.trim().split(";");
  const quality=options.find(option=>option.trim().startsWith("q="));
  const q=quality?Number(quality.trim().slice(2)):1;
  return {locale:resolveLocale(tag.trim()),q:Number.isFinite(q)?q:0,index};
 }).filter(x=>x.locale&&x.q>0).sort((a,b)=>b.q-a.q||a.index-b.index);
 return choices[0]?.locale??defaultLocale;
}
