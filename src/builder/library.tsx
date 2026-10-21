"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2, Monitor, PenLine, Layers, Search } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { authFetch } from "@/local/client";
import { ShareCreation } from "@/components/share-creation";
import { Confirm } from "@/components/ui";
import {normalizeSearch} from "@/lib/model";
import { newBuilder, type BuilderRecord } from "./schema";
import { BuilderCanvas } from "./render";
import type { CustomTheme } from "@/themes/custom/schema";
export function BuilderLibrary({
  initial,
  active,
  themes,
}: {
  initial: BuilderRecord[];
  active: boolean;
  themes: CustomTheme[];
}) {
  const { t, locale } = useI18n(),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remove, setRemove] = useState<BuilderRecord | null>(null),
    [name, setName] = useState(""),
    [query,setQuery]=useState("");
  const visible=initial.filter(item=>normalizeSearch(item.data.name).includes(normalizeSearch(query)));
  const limit = active ? 15 : 3;
  async function create(source?: BuilderRecord) {
    setBusy(true);
    setError("");
    try {
      const data = source
        ? {
            ...source.data,
            name: (source.data.name + " · " + t("Copie")).slice(0, 60),
          }
        : newBuilder(name.trim() || t("Mon overlay"));
      const r = await authFetch("/api/builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: crypto.randomUUID(), data }),
        }),
        result = await r.json();
      if (!r.ok) throw new Error(result.error || "Création impossible.");
      router.push("/builder/" + result.overlay.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
      setBusy(false);
    }
  }
  async function destroy() {
    if (!remove) return;
    setBusy(true);
    try {
      const r = await authFetch("/api/builder/" + remove.id, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: remove.version }),
      });
      if (!r.ok) throw new Error("Suppression impossible. Actualise la page.");
      setRemove(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="builder-home">
      <div className="builder-home-heading">
        <div>
          <h1>{t("Overlay Builder")}</h1>
          <p>{t("Compose ta scène OBS.")}</p>
        </div>
        <span className="builder-count">
          {initial.length} / {limit}
        </span>
      </div>
      <form
        className="builder-create"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input
          aria-label={t("Nom de l’overlay")}
          placeholder={t("Nom de l’overlay")}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="button primary"
          disabled={busy || initial.length >= limit}
        >
          <Plus size={17} />
          {t("Créer un overlay")}
        </button>
      </form>
      {initial.length >= limit && (
        <p className="builder-note">
          {t(
            active
              ? "Limite de 15 créations atteinte."
              : "Jusqu’à 15 compositions locales par profil.",
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      {initial.length>0&&<label className="app-search builder-library-search"><Search size={17}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("Rechercher une composition…")} aria-label={t("Rechercher une composition")}/></label>}
      {initial.length === 0 ? (
        <div className="builder-empty">
          <Layers size={36} />
          <h2>{t("Aucune création")}</h2>
          <p>{t("Ajoute des écrans, ton équipe et tes éléments de stream.")}</p>
        </div>
      ) : (
        <div className="builder-cards">
          {visible.map((o) => (
            <article key={o.id}>
              <Link href={"/builder/" + o.id} className="builder-thumbnail">
                <div>
                  <BuilderCanvas
                    data={o.data}
                    scene={null}
                    themes={themes}
                    placeholders
                  />
                </div>
              </Link>
              <div className="builder-card-meta">
                <Link href={"/builder/" + o.id}>
                  <h2>{o.data.name}</h2>
                </Link>
                <span>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(o.updated_at))}
                </span>
              </div>
              <div className="builder-card-actions">
                <Link href={"/builder/" + o.id}>
                  <PenLine size={15} />
                  {t("Modifier")}
                </Link>
                <Link
                  href={"/builder/" + o.id + "/obs"}
                  title={t("Utiliser dans OBS")}
                >
                  <Monitor size={16} />
                  <span>OBS</span>
                </Link>
                <button
                  aria-label={t("Dupliquer")}
                  title={t("Dupliquer")}
                  disabled={busy || initial.length >= limit}
                  onClick={() => void create(o)}
                >
                  <Copy size={16} />
                </button>
                <ShareCreation kind="overlay" sourceId={o.id} version={o.version} name={o.data.name} disabled={busy} compact />
                <button
                  aria-label={t("Supprimer")}
                  title={t("Supprimer")}
                  disabled={busy}
                  onClick={() => setRemove(o)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {initial.length>0&&!visible.length&&<p className="app-no-results">{t("Aucune composition trouvée.")}</p>}
      <Confirm
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
        title={t("Supprimer cette création ?")}
        description={t("Son URL OBS cessera de fonctionner.")}
        action={t("Supprimer")}
        onConfirm={() => void destroy()}
      />
    </main>
  );
}
