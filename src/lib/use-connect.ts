"use client";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/local/client";
import { effectiveScene, snapshotSchema } from "./connect";
import type { SceneData } from "./model";
export type Device = {
  id: string;
  name: string;
  snapshot: unknown;
  updated_at: string | null;
  last_seen_at?: string | null;
};
export function useConnect(
  sceneId: string | undefined,
  data: SceneData,
  initialDevice?: Device | null,
) {
  const [device, setDevice] = useState<Device | null>(initialDevice || null);
  const [revoked, setRevoked] = useState(false);
  const [online, setOnline] = useState(false);
  const initialDeviceId = initialDevice?.id;
  useEffect(() => {
    if (!sceneId) return;
    let stopped = false;
    let seen = !!initialDeviceId;
    let polling = false;
    let lastSeen = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (stopped || polling) return;
      if (document.hidden) {
        timer = setTimeout(poll, 30000);
        return;
      }
      polling = true;
      try {
        const response = await authFetch(`/api/connect/devices?scene=${sceneId}`, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        if (!response.ok) throw new Error();
        const next: Device | null = await response.json();
        if (!stopped) {
          if (!next && seen) {
            setRevoked(true);
            setOnline(false);
          } else {
            setDevice((current) =>
              current?.id === next?.id &&
              current?.name === next?.name &&
              current?.updated_at === next?.updated_at &&
              current?.last_seen_at === next?.last_seen_at
                ? current
                : next,
            );
            setRevoked(false);
            lastSeen = Date.parse(next?.last_seen_at ?? next?.updated_at ?? "");
            setOnline(Number.isFinite(lastSeen) && Date.now() - lastSeen < 45000);
          }
          if (next) seen = true;
        }
      } catch {
        if (!stopped) setOnline(Number.isFinite(lastSeen) && Date.now() - lastSeen < 45000);
      } finally {
        polling = false;
        if (!stopped) timer = setTimeout(poll, 3000);
      }
    }
    function resume() {
      if (!document.hidden && !polling) {
        clearTimeout(timer);
        void poll();
      }
    }
    document.addEventListener("visibilitychange", resume);
    void poll();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", resume);
      clearTimeout(timer);
      controller.abort();
    };
  }, [sceneId, initialDeviceId]);
  const snapshot = useMemo(
    () => snapshotSchema.safeParse(device?.snapshot),
    [device?.snapshot],
  );
  const displayed = useMemo(
    () => effectiveScene(data, device?.snapshot),
    [data, device?.snapshot],
  );
  return {
    automatedDeaths: snapshot.success && snapshot.data.deaths !== undefined,
    automatedBadges: snapshot.success && snapshot.data.badges !== undefined,
    device,
    online,
    revoked,
    data: displayed,
  };
}
