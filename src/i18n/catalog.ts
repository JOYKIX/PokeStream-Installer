import es from "./messages/es.json";
import de from "./messages/de.json";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import ja from "./messages/ja.json";
import type { Locale } from "./config";
const catalogs: Record<Locale, Record<string, string>> = { en, fr, ja, es, de };
const sourceByEnglish = new Map(Object.entries(en).map(([source, english]) => [english, source]));
export type Translator = (key: string, values?: Record<string, string | number>) => string;
export function translator(locale: Locale): Translator {
  return (key, values) => {
    const trimmed = key.trim();
    const source = sourceByEnglish.get(trimmed) ?? trimmed;
    const value = catalogs[locale][key] ?? catalogs[locale][source] ?? catalogs.en[key] ?? catalogs.en[source];
    let message = value === undefined ? key : key.slice(0, key.indexOf(trimmed)) + value + key.slice(key.indexOf(trimmed) + trimmed.length);
    if (values) message = message.replace(/\{(\w+)\}/g, (match, name: string) => values[name] === undefined ? match : String(values[name]));
    return message;
  };
}
