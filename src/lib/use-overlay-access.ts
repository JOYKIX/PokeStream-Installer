"use client";
import { customThemeConfigSchema, type CustomThemeConfig } from "@/themes/custom/schema";
import { useEffect, useState } from "react";
import type { ThemeId } from "@/themes/catalog";
export function useOverlayAccess(token: string, requested: ThemeId | null, customThemeId?: string) {
  const [permit, setPermit] = useState<{
    token: string;
    theme: ThemeId;
    expiresAt: number;
    customThemeId?: string;
    customTheme?: CustomThemeConfig;
  } | null>(null);
  useEffect(() => {
    if (!requested || token === "demo") return;
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout>;
    let expiryTimer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch(
          "/api/overlay/" + encodeURIComponent(token) + "/access",
          {
            cache: "no-store",
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(8000),
            ]),
          },
        );
        const result = await response.json();
        if (controller.signal.aborted) return;
        clearTimeout(expiryTimer);
        const expiresAt =
          response.ok &&
          result.active === true &&
          result.theme === requested &&
          typeof result.expiresAt === "number"
            ? Math.min(result.expiresAt, Date.now() + 15000)
            : 0;
        const custom = customThemeConfigSchema.safeParse(result.customTheme);
        setPermit(expiresAt > Date.now() && (requested !== "custom" || custom.success)
          ? { token, theme: requested!, expiresAt, customThemeId: result.customThemeId, customTheme: custom.success ? custom.data : undefined } : null);
        if (expiresAt > Date.now())
          expiryTimer = setTimeout(
            () => setPermit(null),
            expiresAt - Date.now(),
          );
      } catch {
        if (!controller.signal.aborted) setPermit(null);
      } finally {
        if (!controller.signal.aborted)
          refreshTimer = setTimeout(refresh, 10000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(expiryTimer);
      setPermit(null);
    };
  }, [token, requested, customThemeId]);
  return requested && permit?.token === token && permit.theme === requested ? permit : null;
}
