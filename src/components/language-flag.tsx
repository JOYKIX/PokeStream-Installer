import type { Locale } from "@/i18n/config";

const countries: Record<Locale, string> = {
  "en": "gb",
  "fr": "fr",
  "ja": "jp",
  "es": "es",
  "de": "de",
  "pt-BR": "br",
  "it": "it",
  "ko": "kr",
  "zh-CN": "cn",
  "zh-TW": "tw"
};

export function LanguageFlag({ locale }: { locale: Locale }) {
  return (
    // Bundled SVG assets keep the language selector available offline.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="language-flag" src={`/flags/${countries[locale]}.svg`} width={28} height={21} alt="" aria-hidden="true" />
  );
}
