"use client";

import { Monitor } from "lucide-react";
import { Select, SelectOption } from "./select";
import { LanguageFlag } from "./language-flag";
import { useI18n } from "@/i18n/client";
import { isLocale, locales, localeNames } from "@/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, locale, preference, setLanguage } = useI18n();

  const label = localeNames[locale];

  const automatic = t("Automatique (navigateur)");

  return (
    <div
      className={
        "language-switcher flag-language" +
        (compact ? " compact-language" : "")
      }
    >
      <Select
        contentClassName="language-select-menu"
        displayValue={<LanguageFlag locale={locale} />}
        value={preference}
        title={preference === "auto" ? automatic + " · " + label : label}
        aria-label={t("Langue") + " : " + label}
        onValueChange={(value) =>
          setLanguage(isLocale(value) ? value : "auto")
        }
      >
        <SelectOption value="auto" textValue={automatic}>
          <span className="language-option" title={automatic}>
            <Monitor size={24} aria-hidden="true" />
            <span className="sr-only">{automatic}</span>
          </span>
        </SelectOption>

        {locales.map((code) => <SelectOption key={code} value={code} textValue={localeNames[code]}>
          <span className="language-option" title={localeNames[code]}><LanguageFlag locale={code} /><span className="sr-only">{localeNames[code]}</span></span>
        </SelectOption>)}
      </Select>
    </div>
  );
}