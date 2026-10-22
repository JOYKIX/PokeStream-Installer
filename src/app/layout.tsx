import { legacyLocaleCookie } from "@/lib/legacy-storage";
import { cookies, headers } from "next/headers";
import { getLocale, getTranslations } from "@/i18n/server";
import { isLocale, localeCookie } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/pixelify-sans";
import "./globals.css";
import "@/styles/site.css";
import "@/styles/controls.css";
import "@/styles/navigation.css";
import "@/styles/application.css";
import "@/styles/flat.css";
import "@/styles/adventure-tools.css";
import "@/styles/obs-integration.css";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: {
      default: t("PokeStream — Overlays Pokémon pour OBS"),
      template: "%s · PokeStream",
    },
    description: t(
      "Création d’overlays Pokémon pour OBS et synchronisation automatique avec Connect.",
    ),
    applicationName: "PokeStream",
  };
}
export const viewport: Viewport = { themeColor: "#09090b" };
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const desktop = (await headers()).get("user-agent")?.includes("Electron/") === true;
  const jar = await cookies();
  const preference =
    jar.get(localeCookie)?.value ?? jar.get(legacyLocaleCookie)?.value;
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body className={desktop ? "desktop-application" : undefined}>
        {desktop && <div className="desktop-window-bar" aria-hidden="true">PokeStream</div>}
        <I18nProvider
          initialLocale={locale}
          initialPreference={isLocale(preference) ? preference : "auto"}
        >
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
