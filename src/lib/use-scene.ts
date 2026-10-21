"use client";
import { readLocalPreference } from "@/lib/legacy-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/local/client";
import { availableTheme } from "./premium";
import type { StarterId } from "@/themes/catalog";
import { DEMO_STORAGE } from "./demo";
import { sceneSchema, type Scene, type SceneData } from "./model";

export function useScene(
  initial: SceneData,
  scene?: Scene,
  demo = false,
  allowPremium = false,
  starter: StarterId | null = null,
) {
  const [data, setData] = useState(initial);
  const [record, setRecord] = useState(scene);
  const [status, setStatus] = useState<"saved" | "saving" | "error" | "local">(
    demo ? "local" : "saved",
  );
  const [error, setError] = useState("");
  const [undoCount, setUndoCount] = useState(0);
  const latest = useRef(initial);
  const version = useRef(scene?.version ?? 1);
  const saved = useRef(JSON.stringify(initial));
  const busy = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const history = useRef<SceneData[]>([]);
  const key = demo ? DEMO_STORAGE : `pokestream-draft-${scene?.id}`;

  const persistLocal = useCallback(
    (next: SceneData) => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify(
            demo ? next : { data: next, version: version.current },
          ),
        );
      } catch {
        /* Storage may be disabled. Cloud saves remain available. */
      }
    },
    [key, demo],
  );

  const save = useCallback(async () => {
    if (demo || !scene || busy.current || blocked.current) return;
    busy.current = true;
    try {
      while (JSON.stringify(latest.current) !== saved.current) {
        setStatus("saving");
        const payload = latest.current;
        const response = await authFetch(`/api/scenes/${scene.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload, version: version.current }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 409) blocked.current = true;
          throw new Error(result.error || "Enregistrement impossible.");
        }
        version.current = result.version;
        saved.current = JSON.stringify(payload);
        setRecord(result);
        persistLocal(latest.current);
      }
      setError("");
      setStatus("saved");
      try {
        localStorage.removeItem(key);
      } catch {
        /* Optional local draft. */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion perdue. Réessaie.");
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }, [demo, scene, key, persistLocal]);

  const update = useCallback(
    (next: SceneData | ((old: SceneData) => SceneData), remember = true) => {
      const value = typeof next === "function" ? next(latest.current) : next;
      const parsed = sceneSchema.safeParse(value);
      if (!parsed.success) {
        setError("Vérifie les valeurs saisies.");
        return;
      }
      if (remember) {
        history.current = [...history.current.slice(-29), latest.current];
        setUndoCount(history.current.length);
      }
      const allowed = availableTheme(parsed.data, allowPremium, starter);
      latest.current = allowed;
      setData(allowed);
      persistLocal(allowed);
      clearTimeout(timer.current);
      if (demo) {
        setStatus("local");
        window.dispatchEvent(new Event("pokestream-demo-change"));
      } else if (!blocked.current) {
        setStatus("saving");
        timer.current = setTimeout(() => void save(), 700);
      }
    },
    [demo, persistLocal, save, allowPremium, starter],
  );

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const raw = readLocalPreference(key);
        if (!raw) return;
        const stored = JSON.parse(raw);
        const parsed = sceneSchema.safeParse(
          demo
            ? stored
            : stored.version === version.current
              ? stored.data
              : null,
        );
        if (parsed.success) update(parsed.data, false);
      } catch {
        /* Discard invalid local data. */
      }
    });
    const unload = (event: BeforeUnloadEvent) => {
      if (!demo && JSON.stringify(latest.current) !== saved.current) {
        event.preventDefault();
      }
    };
    const online = () => {
      if (!blocked.current) void save();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", online);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
    };
  }, [demo, key, save, update]);

  function undo() {
    const previous = history.current.pop();
    if (previous) {
      setUndoCount(history.current.length);
      update(previous, false);
    }
  }
  async function settings(patch: { enabled?: boolean; rotateToken?: boolean }) {
    if (!scene || demo) return;
    if (busy.current || blocked.current) {
      setError("Attends l’enregistrement ou recharge le profil.");
      return;
    }
    await save();
    if (JSON.stringify(latest.current) !== saved.current) return;
    busy.current = true;
    setStatus("saving");
    try {
      const response = await authFetch(`/api/scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, version: version.current }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) blocked.current = true;
        throw new Error(result.error);
      }
      version.current = result.version;
      setRecord(result);
      setError("");
      setStatus("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
      setStatus("error");
    } finally {
      busy.current = false;
      if (!blocked.current && JSON.stringify(latest.current) !== saved.current)
        void save();
    }
  }
  return {
    data,
    record,
    status,
    error,
    update,
    undo,
    undoCount,
    save,
    settings,
  };
}
