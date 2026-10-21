import type { SpriteStyle, SpriteVariant } from "@/lib/sprite-options";

export const THEME_COLLECTIONS = {
  default: "Classiques", types: "Starters",
  "1G": "1G · Game Boy", "2G": "2G · Game Boy Color", "3G": "3G · Game Boy Advance",
  "4G": "4G · Nintendo DS", "5G": "5G · Nintendo DS", "6G": "6G · Nintendo 3DS",
  "7G": "7G · 3DS / Switch", "8G": "8G · Nintendo Switch", "9G": "9G · Nintendo Switch",
} as const;
export type ThemeCollection = keyof typeof THEME_COLLECTIONS;

type ThemeDefinition = {
  label: string;
  access: "free" | "starter" | "pro";
  collection: ThemeCollection;
  family: string;
  console?: string;
  generation?: number;
  defaultAccent?: string;
  defaultSprite?: SpriteStyle;
  defaultVariant?: SpriteVariant;
};

// Stable IDs preserve scenes and account favorites; paired editions share a family.
const definitions = {
  "custom": { label: "Thème personnalisé", access: "pro", family: "custom", collection: "default" },
  "carbon": {"label":"Carbone","access":"free","family":"carbon","defaultAccent":"#ef3340","collection":"default"},
  "ivory": {"label":"Ivoire","access":"free","family":"ivory","defaultAccent":"#b57152","collection":"default"},
  "glass": {"label":"Verre","access":"free","family":"glass","defaultAccent":"#93bbd0","collection":"default"},
  "minimal": {"label":"Minimal","access":"free","family":"minimal","defaultAccent":"#ef3340","collection":"default"},
  "retro": {"label":"Rétro","access":"free","family":"retro","defaultAccent":"#b7c882","defaultSprite":"black-white","collection":"default"},
  "pokedex": {"label":"Pokédex","access":"free","family":"pokedex","defaultAccent":"#ef3340","defaultSprite":"home","collection":"default"},
  "pokedex-retro": {"label":"Pokédex rétro","access":"free","family":"pokedex-retro","defaultAccent":"#c94c52","defaultSprite":"red-blue","defaultVariant":"transparent","collection":"default"},
  "water": {"label":"Eau","access":"free","family":"water","defaultAccent":"#58b5d0","collection":"types"},
  "fire": {"label":"Feu","access":"free","family":"fire","defaultAccent":"#e7955d","collection":"types"},
  "grass": {"label":"Plante","access":"free","family":"grass","defaultAccent":"#8eaf72","collection":"types"},
  "red": {"label":"Rouge","generation":1,"console":"Game Boy","family":"gb","defaultSprite":"red-blue","defaultAccent":"#a84c4c","defaultVariant":"transparent","access":"free","collection":"1G"},
  "green": {"label":"Vert","generation":1,"console":"Game Boy","family":"gb","defaultSprite":"red-green","defaultAccent":"#528258","defaultVariant":"transparent","access":"free","collection":"1G"},
  "blue": {"label":"Bleu","generation":1,"console":"Game Boy","family":"gb","defaultSprite":"red-blue","defaultAccent":"#5478ad","defaultVariant":"transparent","access":"free","collection":"1G"},
  "yellow": {"label":"Jaune","generation":1,"console":"Game Boy","family":"gb","defaultSprite":"yellow","defaultAccent":"#d7b13d","defaultVariant":"transparent","access":"free","collection":"1G"},
  "gold": {"label":"Or","generation":2,"console":"Game Boy Color","family":"gbc","defaultSprite":"gold","defaultAccent":"#b28b3a","defaultVariant":"transparent","access":"free","collection":"2G"},
  "silver": {"label":"Argent","generation":2,"console":"Game Boy Color","family":"gbc","defaultSprite":"silver","defaultAccent":"#7994ad","defaultVariant":"transparent","access":"free","collection":"2G"},
  "crystal": {"label":"Cristal","generation":2,"console":"Game Boy Color","family":"gbc","defaultSprite":"crystal-animated","defaultAccent":"#69a4bf","defaultVariant":"default","access":"free","collection":"2G"},
  "ruby": {"label":"Rubis","generation":3,"console":"Game Boy Advance","family":"advance-hoenn","defaultSprite":"ruby-sapphire","defaultAccent":"#d05257","defaultVariant":"default","access":"free","collection":"3G"},
  "sapphire": {"label":"Saphir","generation":3,"console":"Game Boy Advance","family":"advance-hoenn","defaultSprite":"ruby-sapphire","defaultAccent":"#477dcc","defaultVariant":"default","access":"free","collection":"3G"},
  "emerald": {"label":"Émeraude","generation":3,"console":"Game Boy Advance","family":"advance-hoenn","defaultSprite":"emerald-animated","defaultAccent":"#3c9b76","defaultVariant":"default","access":"free","collection":"3G"},
  "fire-red": {"label":"Rouge Feu","generation":3,"console":"Game Boy Advance","family":"advance-kanto","defaultSprite":"firered-leafgreen","defaultAccent":"#d97546","defaultVariant":"default","access":"free","collection":"3G"},
  "leaf-green": {"label":"Vert Feuille","generation":3,"console":"Game Boy Advance","family":"advance-kanto","defaultSprite":"firered-leafgreen","defaultAccent":"#77a850","defaultVariant":"default","access":"free","collection":"3G"},
  "diamond": {"label":"Diamant","generation":4,"console":"Nintendo DS","family":"ds-sinnoh","defaultSprite":"diamond-pearl","defaultAccent":"#75a5ce","defaultVariant":"default","access":"free","collection":"4G"},
  "pearl": {"label":"Perle","generation":4,"console":"Nintendo DS","family":"ds-sinnoh","defaultSprite":"diamond-pearl","defaultAccent":"#c78da8","defaultVariant":"default","access":"free","collection":"4G"},
  "platinum": {"label":"Platine","generation":4,"console":"Nintendo DS","family":"ds-sinnoh","defaultSprite":"platinum","defaultAccent":"#c6a355","defaultVariant":"default","access":"free","collection":"4G"},
  "heartgold": {"label":"Or HeartGold","generation":4,"console":"Nintendo DS","family":"ds-johto","defaultSprite":"heartgold-soulsilver","defaultAccent":"#c8953b","defaultVariant":"default","access":"free","collection":"4G"},
  "soulsilver": {"label":"Argent SoulSilver","generation":4,"console":"Nintendo DS","family":"ds-johto","defaultSprite":"heartgold-soulsilver","defaultAccent":"#739fbf","defaultVariant":"default","access":"free","collection":"4G"},
  "black": {"label":"Noir","generation":5,"console":"Nintendo DS","family":"ds-unova","defaultSprite":"black-white-animated","defaultAccent":"#c7e38b","defaultVariant":"default","access":"free","collection":"5G"},
  "white": {"label":"Blanc","generation":5,"console":"Nintendo DS","family":"ds-unova","defaultSprite":"black-white-animated","defaultAccent":"#7fbdab","defaultVariant":"default","access":"free","collection":"5G"},
  "black-2": {"label":"Noir 2","generation":5,"console":"Nintendo DS","family":"ds-unova2","defaultSprite":"black-white-animated","defaultAccent":"#5cbada","defaultVariant":"default","access":"free","collection":"5G"},
  "white-2": {"label":"Blanc 2","generation":5,"console":"Nintendo DS","family":"ds-unova2","defaultSprite":"black-white-animated","defaultAccent":"#eaab79","defaultVariant":"default","access":"free","collection":"5G"},
  "x": {"label":"X","generation":6,"console":"Nintendo 3DS","family":"kalos","defaultSprite":"x-y","defaultAccent":"#368fcc","defaultVariant":"default","access":"free","collection":"6G"},
  "y": {"label":"Y","generation":6,"console":"Nintendo 3DS","family":"kalos","defaultSprite":"x-y","defaultAccent":"#d85b64","defaultVariant":"default","access":"free","collection":"6G"},
  "omega-ruby": {"label":"Rubis Oméga","generation":6,"console":"Nintendo 3DS","family":"dexnav","defaultSprite":"omega-alpha","defaultAccent":"#e87965","defaultVariant":"default","access":"free","collection":"6G"},
  "alpha-sapphire": {"label":"Saphir Alpha","generation":6,"console":"Nintendo 3DS","family":"dexnav","defaultSprite":"omega-alpha","defaultAccent":"#5ac5e2","defaultVariant":"default","access":"free","collection":"6G"},
  "sun": {"label":"Soleil","generation":7,"console":"Nintendo 3DS","family":"alola","defaultSprite":"ultra-sun-moon","defaultAccent":"#ef9f62","defaultVariant":"default","access":"free","collection":"7G"},
  "moon": {"label":"Lune","generation":7,"console":"Nintendo 3DS","family":"alola","defaultSprite":"ultra-sun-moon","defaultAccent":"#9b9adc","defaultVariant":"default","access":"free","collection":"7G"},
  "ultra-sun": {"label":"Ultra-Soleil","generation":7,"console":"Nintendo 3DS","family":"ultra","defaultSprite":"ultra-sun-moon","defaultAccent":"#f7b456","defaultVariant":"default","access":"free","collection":"7G"},
  "ultra-moon": {"label":"Ultra-Lune","generation":7,"console":"Nintendo 3DS","family":"ultra","defaultSprite":"ultra-sun-moon","defaultAccent":"#85a1ed","defaultVariant":"default","access":"free","collection":"7G"},
  "lets-go-pikachu": {"label":"Let’s Go, Pikachu","generation":7,"console":"Nintendo Switch","family":"letsgo","defaultSprite":"lets-go","defaultAccent":"#e5b847","defaultVariant":"default","access":"free","collection":"7G"},
  "lets-go-eevee": {"label":"Let’s Go, Évoli","generation":7,"console":"Nintendo Switch","family":"letsgo","defaultSprite":"lets-go","defaultAccent":"#b78a62","defaultVariant":"default","access":"free","collection":"7G"},
  "sword": {"label":"Épée","generation":8,"console":"Nintendo Switch","family":"stadium","defaultSprite":"home","defaultAccent":"#49b6dc","defaultVariant":"default","access":"free","collection":"8G"},
  "shield": {"label":"Bouclier","generation":8,"console":"Nintendo Switch","family":"stadium","defaultSprite":"home","defaultAccent":"#d85587","defaultVariant":"default","access":"free","collection":"8G"},
  "brilliant-diamond": {"label":"Diamant Étincelant","generation":8,"console":"Nintendo Switch","family":"sinnoh-remake","defaultSprite":"brilliant-shining","defaultAccent":"#68aad6","defaultVariant":"default","access":"free","collection":"8G"},
  "shining-pearl": {"label":"Perle Scintillante","generation":8,"console":"Nintendo Switch","family":"sinnoh-remake","defaultSprite":"brilliant-shining","defaultAccent":"#d896b5","defaultVariant":"default","access":"free","collection":"8G"},
  "scarlet": {"label":"Écarlate","generation":9,"console":"Nintendo Switch","family":"academy","defaultSprite":"scarlet-violet","defaultAccent":"#d67846","defaultVariant":"default","access":"free","collection":"9G"},
  "violet": {"label":"Violet","generation":9,"console":"Nintendo Switch","family":"academy","defaultSprite":"scarlet-violet","defaultAccent":"#9380c3","defaultVariant":"default","access":"free","collection":"9G"},
} satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof definitions;
export const THEMES: Record<ThemeId, ThemeDefinition> = definitions;
export const THEME_IDS = Object.keys(THEMES) as [ThemeId, ...ThemeId[]];
export const STARTER_IDS = ["water", "fire", "grass"] as const;
export type StarterId = (typeof STARTER_IDS)[number];
export function themeClassName(theme: ThemeId) {
  return "theme-" + theme + " family-" + THEMES[theme].family;
}
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && Object.hasOwn(THEMES, value);
}
export function isStarterId(value: unknown): value is StarterId {
  return STARTER_IDS.some((id) => id === value);
}
export function requiresPro(theme: ThemeId, starter: StarterId | null = null) {
  return false;
}
