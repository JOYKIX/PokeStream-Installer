"use client";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/local/client";
import {subscribeJSON} from "@/lib/event-source";
import { customThemeSchema, type CustomTheme } from "./schema";
export function useCustomThemes(initial: CustomTheme[], enabled: boolean) {
  const [themes, setThemes] = useState(initial);
  const [error, setError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await authFetch("/api/themes/custom", {
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
          : AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Chargement des thèmes impossible.");
      const parsed = customThemeSchema.array().parse(result.themes);
      if (!signal?.aborted) {
        setThemes((current) =>
          current.length === parsed.length &&
          current.every(
            (theme, index) =>
              theme.id === parsed[index].id &&
              theme.version === parsed[index].version,
          )
            ? current
            : parsed,
        );
        setError("");
      }
      return parsed;
    } catch (e) {
      if (!signal?.aborted)
        setError(
          e instanceof Error ? e.message : "Chargement des thèmes impossible.",
        );
      return null;
    }
  }, []);
  useEffect(()=>{if(!enabled)return;return subscribeJSON<{themes:unknown}>("/api/themes/custom/events",result=>{const parsed=customThemeSchema.array().safeParse(result.themes);if(parsed.success){setThemes(parsed.data);setError("");}},()=>setError("Chargement des thèmes impossible."));},[enabled]);
  return { themes, error, refresh };
}
