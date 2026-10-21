"use client";
import { readLocalPreference } from "@/lib/legacy-storage";
import { useI18n } from "@/i18n/client";
import { THEMES, type StarterId } from "@/themes/catalog";
import { Select, SelectOption } from "./select";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Copy,
  Download,
  LoaderCircle,
  Cable,
  LayoutGrid,
  ArrowRight,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Confirm, Modal } from "./ui";
import { SiteFooter } from "./site-header";
import { PokemonImage } from "./pokemon-image";
import { ShareCreation } from "./share-creation";
import {
  emptyScene,
  sceneSchema,
  type Scene,
  type SceneData,
} from "@/lib/model";
import { GAMES } from "@/lib/games";
import { DEMO_STORAGE } from "@/lib/demo";
import { authFetch } from "@/local/client";

export function Dashboard({
  scenes,
  initialStarter,
}: {
  scenes: Scene[];
  initialStarter: StarterId | null;
}) {
  const { t: tr } = useI18n();
  const [chosenStarter, setStarter] = useState<StarterId | null>(null);
  const starter = initialStarter ?? chosenStarter;
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [game, setGame] = useState<SceneData["game"]>("kanto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<Scene | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function create(data: SceneData) {
    setBusy(true);
    setError("");
    try {
      const response = await authFetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/studio/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Création impossible."));
      setBusy(false);
    }
  }
  async function deleteScene() {
    if (!remove) return;
    setBusy(true);
    try {
      const response = await authFetch(`/api/scenes/${remove.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError(tr("Suppression impossible. Réessaie."));
    } finally {
      setBusy(false);
      setRemove(null);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 24000) {
      setError(tr("Fichier trop volumineux."));
      return;
    }
    try {
      const parsed = sceneSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error();
      await create(parsed.data);
    } catch {
      setError(tr("Ce fichier n’est pas un profil PokeStream valide."));
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  function importDemo() {
    try {
      const parsed = sceneSchema.safeParse(
        JSON.parse(readLocalPreference(DEMO_STORAGE) || "null"),
      );
      if (!parsed.success) {
        setError(tr("Aucune démo enregistrée dans ce navigateur."));
        return;
      }
      void create(parsed.data);
    } catch {
      setError(tr("Démo introuvable."));
    }
  }
  function exportScene(scene: Scene) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scene.data, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "profil-pokestream.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="site-shell dashboard">
      
      <main className="site-container dashboard-main" id="main">
        <div className="dashboard-heading">
          <div>
            <h1>{tr("Mes aventures")}</h1>
            <p>
              {scenes.length} {tr("/ 20 aventures")}
            </p>
          </div>
          <button
            className="button primary"
            disabled={busy || scenes.length >= 20}
            onClick={() => setCreating(true)}
          >
            <Plus size={17} />
            {tr("Nouvelle aventure")}
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {tr(error)}
          </div>
        )}
        <div className="dashboard-toolbar">
          <span>
            {tr("Bibliothèque")}
            {starter && (
              <span className="dashboard-starter">
                {" "}
                {tr("· Starter")} {tr(THEMES[starter].label)}
              </span>
            )}
          </span>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} />
            {tr("Importer")}
          </button>
          <button className="text-link" disabled={busy} onClick={importDemo}>
            <Copy size={14} />
            {tr("Importer ma démo")}
          </button>
          <input
            hidden
            type="file"
            accept="application/json,.json"
            ref={fileRef}
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </div>
        <div className="scene-list">
          {scenes.map((scene) => (
            <article className="scene-row" key={scene.id}>
              <Link className="scene-row-main" href={`/studio/${scene.id}`}>
                <span className="scene-row-icon">
                  <LayoutGrid size={19} />
                </span>
                <div className="scene-row-title">
                  <h2>{scene.data.name}</h2>
                  <div className="scene-row-meta">
                    <span>{tr(GAMES[scene.data.game].region)}</span>
                    <span>
                      {scene.data.team.filter(Boolean).length} {tr("Pokémon")}
                    </span>
                  </div>
                </div>
                <div className="scene-row-team" aria-hidden="true">
                  {scene.data.team
                    .filter((p) => p !== null)
                    .slice(0, 6)
                    .map((p, i) => (
                      <PokemonImage key={i} pokemon={p} size={40} />
                    ))}
                </div>
                <span className="scene-row-state">
                  <span
                    className={scene.enabled ? "status-dot" : "status-dot off"}
                  />
                  <span>
                    {scene.enabled ? tr("Diffusion active") : tr("En pause")}
                  </span>
                </span>
                <ArrowUpRight size={16} className="muted" />
              </Link>
              <div className="scene-row-actions">
                <ShareCreation kind="profile" sourceId={scene.id} version={scene.version}
                  name={scene.data.name} disabled={busy} compact />
                <button
                  className="icon-button"
                  disabled={busy}
                  title={tr("Dupliquer")}
                  aria-label={tr("Dupliquer {name}", { name: scene.data.name })}
                  onClick={() =>
                    void create({
                      ...scene.data,
                      name: tr("Copie de {name}", {
                        name: scene.data.name,
                      }).slice(0, 48),
                    })
                  }
                >
                  <Copy size={15} />
                </button>
                <button
                  className="icon-button"
                  title={tr("Exporter")}
                  aria-label={tr("Exporter {name}", { name: scene.data.name })}
                  onClick={() => exportScene(scene)}
                >
                  <Download size={15} />
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  title={tr("Supprimer")}
                  aria-label={tr("Supprimer {name}", { name: scene.data.name })}
                  onClick={() => setRemove(scene)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          {!scenes.length && (
            <section className="dashboard-empty">
              <LayoutGrid size={28} />
              <h2>{tr("Aucun profil")}</h2>
              <p>{tr("Crée un profil ou importe un fichier existant.")}</p>
              <button
                className="button secondary"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                {tr("Créer un profil")}
              </button>
            </section>
          )}
        </div>
        <section className="dashboard-connect">
          <Cable size={19} />
          <div>
            <h2>Connect</h2>
            <p>
              {tr("Synchronisation locale depuis ton émulateur.")}
            </p>
          </div>
          <Link href="/connect">
            {tr("Gérer Connect")}
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <SiteFooter />
      <Modal
        open={creating}
        onOpenChange={setCreating}
        title={tr("Nouvelle aventure")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = emptyScene(name.trim(), game);
            if (starter)
              next.style = {
                ...next.style,
                theme: starter,
                accent: THEMES[starter].defaultAccent!,
              };
            void create(next);
          }}
        >
          <label className="field">
            {tr("Nom du profil")}
            <input
              autoFocus
              required
              maxLength={48}
              placeholder={tr("Objectif Ligue")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            {tr("Jeu")}
            <Select
              aria-label={tr("Jeu")}
              value={game}
              onValueChange={(value) => setGame(value as SceneData["game"])}
            >
              {Object.entries(GAMES).map(([id, g]) => (
                <SelectOption value={id} key={id}>
                  {tr(g.label)}
                </SelectOption>
              ))}
            </Select>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {tr(error)}
            </p>
          )}
          <button
            disabled={busy || !name.trim()}
            className="button primary full-width"
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}
            {tr("Créer l’aventure")}
          </button>
        </form>
      </Modal>
      <Confirm
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(null)}
        title={tr("Supprimer ce profil ?")}
        description={tr(
          "L’équipe, ses réglages et son lien OBS seront supprimés.",
        )}
        action={tr("Supprimer")}
        onConfirm={() => void deleteScene()}
      />
    </div>
  );
}
