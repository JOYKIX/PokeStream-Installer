"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/local/client";
import { isFavoriteId, type FavoriteId } from "./favorite-id";

function withFavorite(list: FavoriteId[], theme: FavoriteId, favorite: boolean) {
  return favorite ? (list.includes(theme) ? list : [...list, theme]) : list.filter((id) => id !== theme);
}

export function useThemeFavorites(enabled: boolean, demo: boolean) {
  const [favorites, setFavorites] = useState<FavoriteId[] | null>(demo ? [] : null);
  const [pending, setPending] = useState<FavoriteId[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pendingThemes = useRef(new Set<FavoriteId>());
  const revision = useRef(0);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (demo || pendingThemes.current.size) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const startedAtRevision = revision.current;
    setLoading(true);
    try {
      const response = await authFetch("/api/themes/favorites", {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.favorites))
        throw new Error(result.error || "Chargement des favoris impossible.");
      // A background refresh must never overwrite a star clicked after it began.
      if (!controller.signal.aborted && startedAtRevision === revision.current) {
        setFavorites(result.favorites.filter(isFavoriteId));
        setError("");
      }
    } catch (e) {
      if (!controller.signal.aborted && startedAtRevision === revision.current)
        setError(e instanceof Error ? e.message : "Chargement des favoris impossible.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    if (!enabled || demo) return;
    const reload = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      request.current?.abort();
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [enabled, demo, refresh]);

  async function toggle(theme: FavoriteId, favorite: boolean) {
    if (demo || favorites === null || pendingThemes.current.has(theme)) return;
    pendingThemes.current.add(theme);
    revision.current++;
    setPending([...pendingThemes.current]);
    setFavorites((list) => withFavorite(list ?? [], theme, favorite));
    setError("");
    try {
      const response = await authFetch("/api/themes/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, favorite }),
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement du favori impossible.");
    } catch (e) {
      setFavorites((list) => withFavorite(list ?? [], theme, !favorite));
      setError(e instanceof Error ? e.message : "Enregistrement du favori impossible. Réessaie.");
    } finally {
      pendingThemes.current.delete(theme);
      setPending([...pendingThemes.current]);
    }
  }
  return { favorites, pending, loading, error, refresh, toggle };
}
