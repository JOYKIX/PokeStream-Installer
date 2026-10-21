"use client";
import { legacyLocaleCookie } from "@/lib/legacy-storage";
import { createContext, useContext, useMemo, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { detectLocale, isLocale, localeCookie, type Locale } from "./config";
import { translator, type Translator } from "./catalog";
type I18n = { locale: Locale; preference: Locale | "auto"; t: Translator; setLanguage: (value: Locale | "auto") => void };
const Context = createContext<I18n | null>(null);
export function I18nProvider({ initialLocale, initialPreference, children }: {
  initialLocale: Locale; initialPreference: Locale | "auto"; children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState(initialLocale);
  const [preference, setPreference] = useState(initialPreference);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLanguage = useCallback((value: Locale | "auto") => {
    const next = isLocale(value) ? value : detectLocale(navigator.languages?.join(",") || navigator.language);
    document.cookie = localeCookie + "=" + (isLocale(value) ? value : "") + "; Path=/; Max-Age=" + (isLocale(value) ? "31536000" : "0") + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    document.cookie = legacyLocaleCookie + "=; Path=/; Max-Age=0; SameSite=Lax";
    setPreference(value); setLocale(next);
    const desktop = (window as Window & { pokeStream?: { language?: { set: (language: Locale | "auto") => Promise<{ locale?: unknown }> } } }).pokeStream?.language;
    // Persist the same preference for the native launcher and future app sessions.
    if (desktop) void desktop.set(value).then(result => { if (isLocale(result.locale)) setLocale(result.locale); router.refresh(); }).catch(() => router.refresh());
    else router.refresh();
  }, [router]);
  const value = useMemo(() => ({ locale, preference, t: translator(locale), setLanguage }), [locale, preference, setLanguage]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error("I18nProvider is missing");
  return value;
}
