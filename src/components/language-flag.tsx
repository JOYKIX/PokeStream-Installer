import type { Locale } from "@/i18n/config";

export function LanguageFlag({ locale }: { locale: Locale }) {
  return (
    <svg
      className="language-flag"
      viewBox="0 0 60 40"
      aria-hidden="true"
      focusable="false"
    >
      {locale === "fr" ? (
        <>
          {/* France */}
          <path fill="#fff" d="M0 0h60v40H0z" />
          <path fill="#002654" d="M0 0h20v40H0z" />
          <path fill="#ed2939" d="M40 0h20v40H40z" />
        </>
      ) : locale === "ja" ? (
        <>
          {/* Japan */}
          <path fill="#fff" d="M0 0h60v40H0z" />
          <circle cx="30" cy="20" r="12" fill="#bc002d" />
        </>
      ) : locale === "de" ? (
        <><path fill="#ffce00" d="M0 0h60v40H0z" /><path fill="#000" d="M0 0h60v13.333H0z" /><path fill="#d00" d="M0 13.333h60v13.334H0z" /></>
      ) : locale === "es" ? (
        <><path fill="#aa151b" d="M0 0h60v40H0z" /><path fill="#f1bf00" d="M0 10h60v20H0z" /><path fill="#aa151b" d="M17 16h9v9l-4.5 3-4.5-3z" /><path fill="#f4e8c1" d="M18 17h3v4h-3zm4 0h3v4h-3zm-4 5h3v3h-3zm4 0h3v3h-3z" /><path fill="#aa151b" d="m17 14 2 1 2.5-3 2.5 3 2-1v2h-9z" /><path fill="#f4e8c1" d="M14 17h2v9h-2zm13 0h2v9h-2z" /></>
      ) : (
        <>
          {/* United Kingdom */}
          <path fill="#012169" d="M0 0h60v40H0z" />
          <path
            stroke="#fff"
            strokeWidth="8"
            d="m0 0 60 40M60 0 0 40"
          />
          <path
            fill="#c8102e"
            d="M0 0v3l26 17h4zm60 0h-4L30 17v3zm0 40v-3L34 20h-4zM0 40h4l26-17v-3z"
          />
          <path
            stroke="#fff"
            strokeWidth="13"
            d="M30 0v40M0 20h60"
          />
          <path
            stroke="#c8102e"
            strokeWidth="8"
            d="M30 0v40M0 20h60"
          />
        </>
      )}
    </svg>
  );
}