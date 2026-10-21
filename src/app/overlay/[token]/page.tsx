import { getTranslations } from "@/i18n/server";
import { OverlayLocale } from "@/i18n/overlay-locale";
import { LiveOverlay } from "@/components/live-overlay";
import { z } from "zod";
import "./overlay.css";
export async function generateMetadata() { const tr = await getTranslations(); return { title: tr("Overlay OBS"), robots: { index: false, follow: false } }; }
export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ part?: string; lang?: string }>;
}) {
  const { token } = await params;
  const { part = "all", lang } = await searchParams;
  if (token !== "demo" && !z.uuid().safeParse(token).success)
    return <div className="obs-output" />;
  const allowed = [
    "all",
    "team",
    "badges",
    "deaths",
    ...Array.from({ length: 6 }, (_, i) => `slot-${i + 1}`),
  ];
  return (
    <OverlayLocale language={lang}><LiveOverlay token={token} part={allowed.includes(part) ? part : "all"} /></OverlayLocale>
  );
}
