"use client";
import { useI18n } from "@/i18n/client";
import { THEMES, type StarterId } from "@/themes/catalog";
import {GamePicker} from "./game-picker";
import {ChoiceGroup} from "./choice-group";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Search,
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
  normalizeSearch,
  sceneSchema,
  type Scene,
  type SceneData,
} from "@/lib/model";
import { GAMES } from "@/lib/games";
import { authFetch } from "@/local/client";

export function Dashboard({
  scenes,
  initialStarter,
}: {
  scenes: Scene[];
  initialStarter: StarterId | null;
}) {
  const { t: tr } = useI18n();
  const starter = initialStarter;
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState("recent");
  const visibleScenes=scenes.filter(scene=>normalizeSearch(scene.data.name+" "+tr(GAMES[scene.data.game].label)).includes(normalizeSearch(query))).sort((a,b)=>sort==="name"?a.data.name.localeCompare(b.data.name):Date.parse(b.updated_at)-Date.parse(a.updated_at));
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
            <h1>{tr("Profils de jeu")}<span className="app-count">{scenes.length} / 20</span></h1>
            <p>{tr("Équipe, apparence et sources OBS.")}</p>
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
        <div className="library-searchbar"><div className="app-search"><Search size={16}/><input type="search" placeholder={tr("Rechercher un profil…")} aria-label={tr("Rechercher un profil…")} value={query} onChange={event=>setQuery(event.target.value)}/></div><div className="app-heading-actions"><ChoiceGroup label={tr("Trier")} value={sort} options={[{value:"recent",label:tr("Récents")},{value:"name",label:tr("Nom")}]} onChange={setSort}/><button className="button secondary compact" disabled={busy} onClick={()=>fileRef.current?.click()}><Upload size={15}/>{tr("Importer")}</button></div><input hidden type="file" accept="application/json,.json" ref={fileRef} onChange={event=>void importFile(event.target.files?.[0])}/></div>
        <div className="profile-library-grid">{visibleScenes.map(scene=><article className="profile-library-card" key={scene.id}>
          <Link className="profile-library-link" href={"/studio/"+scene.id}><div className="profile-library-title"><div><h2>{scene.data.name}</h2><span className="profile-library-game">{tr(GAMES[scene.data.game].label)}</span></div><span className="profile-status" data-enabled={scene.enabled}><i/>{tr(scene.enabled?"Diffusion active":"En pause")}</span></div>
            <div className="profile-library-team" aria-hidden="true">{scene.data.team.map((pokemon,i)=>pokemon?<PokemonImage key={i} pokemon={pokemon} size={58}/>:<span key={i}><Plus size={13}/></span>)}</div>
          </Link>
          <div className="profile-library-footer"><Link href={"/studio/"+scene.id}>{tr("Ouvrir le profil")}<ArrowUpRight size={14}/></Link><div className="scene-row-actions">
            <ShareCreation kind="profile" sourceId={scene.id} version={scene.version} name={scene.data.name} disabled={busy} compact/>
            <button className="icon-button" disabled={busy} title={tr("Dupliquer")} aria-label={tr("Dupliquer")+" · "+scene.data.name} onClick={()=>void create({...scene.data,name:tr("Copie de {name}",{name:scene.data.name}).slice(0,48)})}><Copy size={15}/></button>
            <button className="icon-button" title={tr("Exporter")} aria-label={tr("Exporter")+" · "+scene.data.name} onClick={()=>exportScene(scene)}><Download size={15}/></button>
            <button className="icon-button" disabled={busy} title={tr("Supprimer")} aria-label={tr("Supprimer")+" · "+scene.data.name} onClick={()=>setRemove(scene)}><Trash2 size={15}/></button>
          </div></div>
        </article>)}</div>
        {!scenes.length&&<section className="dashboard-empty"><LayoutGrid size={27}/><h2>{tr("Aucun profil")}</h2><p>{tr("Crée un profil ou importe un fichier existant.")}</p><div className="app-heading-actions"><button className="button primary" onClick={()=>setCreating(true)}><Plus size={16}/>{tr("Créer un profil")}</button><Link className="button secondary" href="/studio/demo">{tr("Voir un exemple")}</Link></div></section>}
        {scenes.length>0&&!visibleScenes.length&&<p className="app-no-results">{tr("Aucun résultat.")}</p>}
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
            <GamePicker value={game} onChange={setGame}/>
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
