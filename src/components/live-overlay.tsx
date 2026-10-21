"use client";
import { readLocalPreference } from "@/lib/legacy-storage";
import { useEffect, useState } from "react";

import { sceneSchema, type SceneData } from "@/lib/model";
import { DEMO_STORAGE, demoScene } from "@/lib/demo";
import { OverlayStage } from "./overlay-stage";
import { useOverlayAccess } from "@/lib/use-overlay-access";
import { isThemeId, type ThemeId } from "@/themes/catalog";
import { availableTheme } from "@/lib/premium";
export function LiveOverlay({ token, part }: { token: string; part: string }) {
  const [data, setData] = useState<SceneData | null>(null);
  const [premiumRequested, setPremiumRequested] = useState<ThemeId | null>(null);
  const premium = useOverlayAccess(token, premiumRequested, premiumRequested === "custom" ? data?.style.customThemeId : undefined);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastVersion: string | number = -1;
    let failures = 0;

    const controller = new AbortController();
    async function refresh() {
      try {
        if (token === "demo") {
          const parsed = sceneSchema.safeParse(
            JSON.parse(readLocalPreference(DEMO_STORAGE) || "null"),
          );
          if (!stopped)
            setData(
              availableTheme(parsed.success ? parsed.data : demoScene(), false),
            );
        } else {
          const response = await fetch("/api/overlay/" + token, {cache:"no-store", signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
          if(!response.ok)throw new Error("Local source unavailable");
          const payload = await response.json();
          if (stopped) return;
          setPremiumRequested(isThemeId(payload?.restricted_theme) ? payload.restricted_theme : payload?.premium_theme === true ? "retro" : null);
          if (!payload) {
            setData(null);
            lastVersion = -1;
          } else if (payload.version !== lastVersion) {
            const parsed = sceneSchema.safeParse(payload.data);
            setData(parsed.success ? parsed.data : null);
            lastVersion = payload.version;
          }
        }
        failures = 0;
      } catch {
        // Keep the last valid frame during network failures, never show UI in OBS.
        failures++;
      } finally {
        if (!stopped)
          timer = setTimeout(
            refresh,
            Math.min(15000, 2000 * Math.max(1, failures)),
          );
      }
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [token]);
  return (
    <div className="obs-output">
      {data && (
        <OverlayStage
          viewport
          data={
            premium && (premium.theme !== "custom" || premium.customThemeId === data.style.customThemeId)
              ? { ...data, style: { ...data.style, theme: premium.theme, customTheme: premium.customTheme } }
              : data
          }
          part={part}
        />
      )}
    </div>
  );
}
