import es from "./messages/es.json";
import ptBR from "./messages/pt-BR.json";
import it from "./messages/it.json";
import ko from "./messages/ko.json";
import zhCN from "./messages/zh-CN.json";
import zhTW from "./messages/zh-TW.json";
import de from "./messages/de.json";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import ja from "./messages/ja.json";
import engineEn from "../../desktop/connect/src/Connect.Desktop/Localization/en.json";
import engineFr from "../../desktop/connect/src/Connect.Desktop/Localization/fr.json";
import engineJa from "../../desktop/connect/src/Connect.Desktop/Localization/ja.json";
import type { Locale } from "./config";
const catalogs: Record<Locale, Record<string, string>> = { en: { ...engineEn, ...en }, fr: { ...engineFr, ...fr }, ja: { ...engineJa, ...ja }, es, de, "pt-BR": ptBR, it, ko, "zh-CN": zhCN, "zh-TW": zhTW };
const sourceByEnglish = new Map(Object.entries(catalogs.en).map(([source, english]) => [english, source]));
export type Translator = (key: string, values?: Record<string, string | number>) => string;
export function translator(locale: Locale): Translator {
  return (key, values) => {
    const trimmed = key.trim();
    const source = catalogs[locale][key] !== undefined ? key : sourceByEnglish.get(trimmed) ?? trimmed;
    const value = catalogs[locale][key] ?? catalogs[locale][source] ?? catalogs[locale][trimmed] ?? catalogs.en[key] ?? catalogs.en[source];
    const start = key.indexOf(trimmed), before = key.slice(0, start), after = key.slice(start + trimmed.length);
    let message = value === undefined ? key : (value.startsWith(before) ? "" : before) + value + (value.endsWith(after) ? "" : after);
    if (values) message = message.replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]));
    return message;
  };
}
