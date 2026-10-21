import { z } from "zod";
import { OverlayLocale } from "@/i18n/overlay-locale";
import { BuilderLive } from "@/builder/live";
import "@/app/overlay/[token]/overlay.css";
import "@/builder/builder.css";
export const metadata = {
  title: "PokeStream · OBS",
  robots: { index: false, follow: false },
};
export default async function BuilderOBS({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params,
    { lang } = await searchParams;
  return (
    <OverlayLocale language={lang}>
      {z.uuid().safeParse(token).success ? (
        <BuilderLive token={token} />
      ) : (
        <div className="obs-output" />
      )}
    </OverlayLocale>
  );
}
