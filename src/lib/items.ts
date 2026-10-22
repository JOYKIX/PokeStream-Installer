import names from "@/data/localized-game-names.json";
import type { Locale } from "@/i18n/config";
import catalog from "@/data/items.json";
import { normalizeSearch } from "./model";
export const ITEMS = catalog;
const index = new Map<string, (typeof catalog)[number]>();
for (const item of catalog)
  for (const key of [item.name, item.en, item.slug, ...Object.values(names.items).map((catalog) => (catalog as Record<string, string>)[item.slug]).filter(Boolean)])
    if (normalizeSearch(key)) index.set(normalizeSearch(key), item);
export function findItem(value: string) {
  const key=normalizeSearch(value);
  return key ? index.get(key) : undefined;
}
export function itemSpriteUrl(value: string) {
  const item = findItem(value);
  return item
    ? "/api/sprites/items/" +
        item.slug +
        ".png"
    : null;
}

export function itemName(item: (typeof ITEMS)[number], locale: Locale) {
  return (names.items[locale as keyof typeof names.items] as Record<string, string> | undefined)?.[item.slug] || (locale === "fr" ? item.name : item.en);
}
