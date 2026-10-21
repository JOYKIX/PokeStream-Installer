"use client";
import { useI18n } from "@/i18n/client";
import { Select, SelectOption } from "./select";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Link2, Monitor, Unplug } from "lucide-react";
import { authFetch } from "@/local/client";
import { emptyScene } from "@/lib/model";
import { Confirm } from "./ui";
type Device = {
  id: string;
  name: string;
  scene_id: string | null;
  updated_at: string | null;
};
type Scene = { id: string; name: string };
export function ConnectPanel({
  scenes,
  devices,
  pairing,
}: {
  scenes: Scene[];
  devices: Device[];
  pairing?: { device: string; challenge: string; name: string; mode?: "account" };
}) {
  const { t: tr } = useI18n();
  const router = useRouter();
  const [scene, setScene] = useState(
    scenes.find((s) => !devices.some((d) => d.scene_id === s.id))?.id || "new",
  );
  const [done, setDone] = useState(
    devices.some((d) => d.id === pairing?.device),
  );
  const [name, setName] = useState(tr("Mon profil"));
  const [created, setCreated] = useState<Scene | null>(null);
  const available = [
    ...scenes.filter((s) => !devices.some((d) => d.scene_id === s.id)),
    ...(created && !scenes.some((s) => s.id === created.id) ? [created] : []),
  ];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<Device | null>(null);
  async function pair() {
    setBusy(true);
    setError("");
    try {
      let target = scene;
      if (pairing?.mode !== "account" && target === "new") {
        const response = await authFetch("/api/scenes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            emptyScene(name.trim() || tr("Mon profil"), "sinnoh"),
          ),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || tr("Création impossible."));
        target = result.id;
        setCreated({ id: target, name: result.data.name });
        setScene(target);
      }
      const r = await authFetch("/api/connect/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pairing, ...(pairing?.mode !== "account" && { scene: target }) }),
      });
      if (!r.ok)
        throw new Error((await r.json()).error || tr("Association impossible."));
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Connexion interrompue."));
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      const r = await authFetch("/api/connect/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: remove.id }),
      });
      if (!r.ok) throw new Error(tr("Déconnexion impossible."));
      setRemove(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Connexion interrompue."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="connect-account">
      {pairing && (
        <section className="connect-card">
          <span className="eyebrow">{tr("ASSOCIATION")}</span>
          {done ? (
            <>
              <h2>
                <Check /> {tr(" Appareil associé")}</h2>
              <p>{tr(pairing.mode === "account" ? "Reviens dans Connect et choisis ton profil." : "Reviens dans Connect et lance ton jeu.")}</p>
              <Link className="button secondary" href="/studio">
                {tr("Ouvrir le studio")}</Link>
            </>
          ) : (
            <>
              <h2>
                <Monitor /> {pairing.name}
              </h2>
              <p>{tr("Autorise cet appareil à synchroniser ton équipe.")}</p>
              {pairing.mode === "account" ? <p>{tr("Choisis ton profil dans l’application Connect.")}</p> : <>
              <label htmlFor="connect-scene">{tr("Profil")}</label>
              <Select
                aria-label={tr("Profil")}
                id="connect-scene"
                value={scene}
                onValueChange={(value) => setScene(value)}
                disabled={busy}
              >
                <SelectOption value="new">{tr("Nouveau profil")}</SelectOption>
                {available.map((s) => (
                  <SelectOption key={s.id} value={s.id}>
                    {s.name}
                  </SelectOption>
                ))}
              </Select>
              {scene === "new" && (
                <>
                  <label htmlFor="connect-name">{tr("Nom du profil")}</label>
                  <input
                    id="connect-name"
                    value={name}
                    maxLength={48}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </>
              )}
              </>}
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void pair()}
              >
                <Link2 size={18} />
                {busy ? tr("Association…") : tr("Associer")}
              </button>
            </>
          )}
        </section>
      )}
      <section className="connect-card">
        <h2>
          {tr("Mes appareils ")}<span className="muted">{devices.length}</span>
        </h2>
        {devices.length === 0 ? (
          <p>{tr("Aucun appareil associé.")}</p>
        ) : (
          devices.map((d) => (
            <div className="connect-device" key={d.id}>
              <Monitor size={21} />
              <div>
                <strong>{d.name}</strong>
                {d.scene_id ? <Link href={`/studio/${d.scene_id}`}>
                  {scenes.find((s) => s.id === d.scene_id)?.name || tr("Profil")}
                </Link> : <span className="muted">{tr("Aucun profil sélectionné")}</span>}
              </div>
              <button
                className="icon-button"
                onClick={() => setRemove(d)}
                aria-label={tr("Révoquer {name}", { name: d.name })}
              >
                <Unplug size={19} />
              </button>
            </div>
          ))
        )}
      </section>
      {error && (
        <p role="alert" className="form-error">
          {tr(error)}
        </p>
      )}
      <Confirm
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
        onConfirm={() => void revoke()}
        title={tr("Déconnecter cet appareil ?")}
        description={tr("La dernière équipe reçue restera dans ton profil.")}
        action={busy ? tr("Déconnexion…") : tr("Déconnecter")}
      />
    </div>
  );
}
