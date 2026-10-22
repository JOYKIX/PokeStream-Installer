"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/local/client";
import {
  builderSchema,
  type BuilderData,
  type BuilderRecord,
  type BuilderAsset,
} from "./schema";
const imageIds = (document: BuilderData) =>
  document.elements.flatMap((e) =>
    e.type === "image" && e.properties.assetId ? [e.properties.assetId] : [],
  );
export function useBuilderDocument(initial: BuilderRecord) {
  const [record, setRecord] = useState(initial),
    [data, setData] = useState(initial.data),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState({
      undo: [] as BuilderData[],
      redo: [] as BuilderData[],
    }),
    [draft, setDraft] = useState<BuilderData | null>(null),
    [savedData, setSavedData] = useState(initial.data);
  const trackedAssets = useRef(new Set(imageIds(initial.data)));
  const [assetLibrary, setAssetLibrary] = useState<{
    items: BuilderAsset[];
    checkedIds: string[];
  } | null>(null);
  const historyRef = useRef(history);
  const setSteps = useCallback((next: typeof history) => {
    historyRef.current = next;
    setHistory(next);
  },[]);
  const latest = useRef(data),
    saved = useRef(initial.data),
    version = useRef(initial.version),
    busy = useRef(false),
    blocked = useRef(false);
  const key = "pokestream-builder-" + initial.id;
  const update = useCallback(
    (
      value: BuilderData | ((old: BuilderData) => BuilderData),
      remember = true,
    ) => {
      const previous = latest.current,
        next = typeof value === "function" ? value(previous) : value;
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      imageIds(previous).forEach((id) => trackedAssets.current.add(id));
      imageIds(next).forEach((id) => trackedAssets.current.add(id));
      latest.current = next;
      setData(next);
      if (remember) {
        const h = historyRef.current;
        const next = { undo: [...h.undo.slice(-49), previous], redo: [] };
        historyRef.current = next;
        setHistory(next);
      }
    },
    [],
  );
  const remember = () =>
    setSteps({
      undo: [...historyRef.current.undo.slice(-49), latest.current],
      redo: [],
    });
  const undo = () => {
    const h = historyRef.current,
      next = h.undo.at(-1);
    if (!next) return;
    const previous = latest.current;
    update(next, false);
    setSteps({ undo: h.undo.slice(0, -1), redo: [...h.redo, previous] });
  };
  const redo = () => {
    const h = historyRef.current,
      next = h.redo.at(-1);
    if (!next) return;
    const previous = latest.current;
    update(next, false);
    setSteps({ undo: [...h.undo, previous], redo: h.redo.slice(0, -1) });
  };
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      if (raw?.version === initial.version) {
        const p = builderSchema.safeParse(raw.data);
        if (Array.isArray(raw.assets))
          for (const id of raw.assets) {
            if (
              typeof id === "string" &&
              /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
            )
              trackedAssets.current.add(id);
          }
        if (
          p.success &&
          JSON.stringify(p.data) !== JSON.stringify(initial.data)
        )
          queueMicrotask(() => setDraft(p.data));
      }
    } catch {}
    const unload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== JSON.stringify(saved.current))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [key, initial]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (JSON.stringify(data) !== JSON.stringify(saved.current))
          localStorage.setItem(
            key,
            JSON.stringify({
              version: version.current,
              data,
              assets: [...trackedAssets.current],
            }),
          );
      } catch {}
    }, 350);
    return () => clearTimeout(timer);
  }, [data, key]);
  const save=useCallback(async (
    options: { enabled?: boolean; rotateToken?: boolean } = {},
  ) => {
    if (busy.current || blocked.current) return false;
    const parsed = builderSchema.safeParse(latest.current);
    if (!parsed.success) {
      setError("Création invalide.");
      return false;
    }
    // Only this snapshot can be invalidated by this save; uploads may finish meanwhile.
    const checkedIds = [...trackedAssets.current];
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await authFetch("/api/builder/" + record.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: parsed.data,
          version: version.current,
          discardAssets: checkedIds
            .filter((id) => !imageIds(parsed.data).includes(id))
            .slice(0, 200),
          ...options,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) blocked.current = true;
        throw new Error(result.error || "Enregistrement impossible.");
      }
      const next = result.overlay as BuilderRecord;
      version.current = next.version;
      saved.current = next.data;
      setSavedData(next.data);
      setRecord(next);
      if (Array.isArray(result.assets)) {
        const assets = result.assets as BuilderAsset[],
          existing = new Set(assets.map((a) => a.id));
        setAssetLibrary({ items: assets, checkedIds });
        const gone = new Set(checkedIds.filter((id) => !existing.has(id)));
        if (gone.size) {
          const h = historyRef.current;
          const valid = (d: BuilderData) =>
            !imageIds(d).some((id) => gone.has(id));
          setSteps({ undo: h.undo.filter(valid), redo: h.redo.filter(valid) });
          const current = latest.current;
          if (!valid(current))
            update(
              {
                ...current,
                elements: current.elements.map((e) =>
                  e.type === "image" &&
                  e.properties.assetId &&
                  gone.has(e.properties.assetId)
                    ? { ...e, properties: { ...e.properties, assetId: null } }
                    : e,
                ),
              },
              false,
            );
          gone.forEach((id) => trackedAssets.current.delete(id));
        }
      }
      try {
        if (JSON.stringify(latest.current) === JSON.stringify(saved.current))
          localStorage.removeItem(key);
        else
          localStorage.setItem(
            key,
            JSON.stringify({
              version: version.current,
              data: latest.current,
              assets: [...trackedAssets.current],
            }),
          );
      } catch {}
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      return false;
    } finally {
      setSaving(false);
      busy.current = false;
    }
  },[record.id,key,setSteps,update]);
  return {
    data,
    record,
    assetLibrary,
    trackAsset: (id: string) => trackedAssets.current.add(id),
    update,
    remember,
    undo,
    redo,
    canUndo: history.undo.length > 0,
    canRedo: history.redo.length > 0,
    save,
    saving,
    error,
    setError,
    dirty: JSON.stringify(data) !== JSON.stringify(savedData),
    draft,
    recover: () => {
      if (draft) update(draft);
      setDraft(null);
    },
    discard: () => {
      setDraft(null);
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}
