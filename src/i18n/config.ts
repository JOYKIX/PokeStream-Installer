export const locales = ["en", "fr", "ja", "es", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "pokestream-language";
export function isLocale(value: unknown): value is Locale { return locales.includes(value as Locale); }
export function detectLocale(languages: string | null | undefined): Locale {
  const preferred = (languages ?? "").split(",").map((value, index) => {
    const [tag, ...options] = value.trim().split(";");
    const quality = options.find((option) => option.trim().startsWith("q="));
    const q = quality ? Number(quality.trim().slice(2)) : 1;
    return { tag: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, index };
  }).filter(({ q }) => q > 0).sort((a, b) => b.q - a.q || a.index - b.index)[0]?.tag;
  return isLocale(preferred) ? preferred : defaultLocale;
}

export const localeNames: Record<Locale, string> = { en: "English", fr: "Français", ja: "日本語", es: "Español", de: "Deutsch" };
