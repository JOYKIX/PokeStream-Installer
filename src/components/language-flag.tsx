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
      ) : locale === "pt-BR" ? (
        <><path fill="#009b3a" d="M0 0h60v40H0z"/><path fill="#ffdf00" d="M30 3 56 20 30 37 4 20z"/><circle cx="30" cy="20" r="9.5" fill="#002776"/></>
      ) : locale === "it" ? (
        <><path fill="#009246" d="M0 0h20v40H0z"/><path fill="#fff" d="M20 0h20v40H20z"/><path fill="#ce2b37" d="M40 0h20v40H40z"/></>
      ) : locale === "ko" ? (
        <><path fill="#fff" d="M0 0h60v40H0z"/><g transform="translate(30 20) rotate(-32)"><circle r="11" fill="#cd2e3a"/><path d="M-11 0a5.5 5.5 0 0 0 11 0 5.5 5.5 0 0 1 11 0 11 11 0 0 1-22 0" fill="#0047a0"/></g></>
      ) : locale === "zh-CN" ? (
        <><path fill="#de2910" d="M0 0h60v40H0z"/><path fill="#ffde00" d="m12 6 2 5h5l-4 3 1.5 5-4.5-3-4.5 3 1.5-5-4-3h5z"/><circle cx="27" cy="6" r="2" fill="#ffde00"/><circle cx="33" cy="12" r="2" fill="#ffde00"/></>
      ) : locale === "zh-TW" ? (
        <><path fill="#fe0000" d="M0 0h60v40H0z"/><path fill="#000095" d="M0 0h30v21H0z"/><circle fill="#fff" cx="15" cy="10.5" r="6.5"/><circle fill="#000095" cx="15" cy="10.5" r="3.2"/></>
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