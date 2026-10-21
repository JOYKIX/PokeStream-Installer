"use client";
import { useEffect, useState } from "react";
import type { SceneData } from "@/lib/model";
import { builderSchema, type BuilderData } from "./schema";
import { BuilderCanvas, type DisplayTheme } from "./render";
type Payload = {
  data: BuilderData;
  scene: SceneData | null;
  themes: DisplayTheme[];
  expiresAt: number;
};
export function BuilderLive({ token }: { token: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>,
      expiry: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const r = await fetch("/api/builder/obs/" + token, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        if (stopped) return;
        if (r.status === 404) {
          setPayload(null);
          return;
        }
        if (!r.ok) throw new Error();
        const next = (await r.json()) as Payload;
        if (stopped) return;
        next.data = builderSchema.parse(next.data);
        setPayload((old) =>
          JSON.stringify(old) === JSON.stringify(next) ? old : next,
        );
        clearTimeout(expiry);
        expiry = setTimeout(
          () => {
            if (!stopped) setPayload(null);
          },
          Math.max(0, next.expiresAt - Date.now()),
        );
      } catch {
        /* OBS stays free of errors; the display lease expires if access cannot be checked. */
      } finally {
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      clearTimeout(expiry);
    };
  }, [token]);
  return (
    <div className="obs-output">
      {payload && (
        <BuilderCanvas
          data={payload.data}
          scene={payload.scene}
          themes={payload.themes}
          token={token}
        />
      )}
    </div>
  );
}
