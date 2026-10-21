"use client";
import { type ReactNode } from "react";
import { useI18n, I18nProvider } from "./client";
import { isLocale } from "./config";
export function OverlayLocale({ language, children }: { language?: string; children: ReactNode }) {
  const parent = useI18n();
  const locale = isLocale(language) ? language : parent.locale;
  return <I18nProvider key={locale} initialLocale={locale} initialPreference={locale}>{children}</I18nProvider>;
}
