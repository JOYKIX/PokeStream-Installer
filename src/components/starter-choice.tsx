"use client";
import { useI18n } from "@/i18n/client";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Droplets, Flame, Leaf, LoaderCircle } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/local/client";
import { isStarterId, STARTER_IDS, THEMES, type StarterId } from "@/themes/catalog";
const icons = { water: Droplets, fire: Flame, grass: Leaf };

export function StarterChoice({ onChosen }: { onChosen: (starter: StarterId) => void }) {
  const { t: tr } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<StarterId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  async function choose() {
    if (!selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await authFetch("/api/themes/starter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selected }),
      });
      const result = await response.json();
      if (!response.ok || !isStarterId(result.starter)) throw new Error(result.error || tr("Enregistrement impossible."));
      onChosen(result.starter);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Enregistrement impossible. Réessaie."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal starter-modal"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}>
          <Dialog.Title>{tr("Choisis ton starter")}</Dialog.Title>
          <Dialog.Description>
            {tr("Un thème gratuit, choisi une fois pour ton compte. Les deux autres nécessitent Pro.")}</Dialog.Description>
          <div className="starter-options" role="group" aria-label={tr("Thème gratuit")}>
            {STARTER_IDS.map((id) => {
              const Icon = icons[id];
              return (
                <button type="button" key={id} className={"starter-option " + (selected === id ? "selected" : "")}
                  aria-pressed={selected === id} disabled={busy} onClick={() => setSelected(id)}
                  style={{ "--starter-color": THEMES[id].defaultAccent } as CSSProperties}>
                  <Icon className="starter-icon" size={26} aria-hidden="true" />
                  <span className={"theme-sample sample-" + id} aria-hidden="true"><span /><span /><span /></span>
                  <strong>{tr(THEMES[id].label)}</strong>
                  <span className="starter-radio" aria-hidden="true">{selected === id && <Check size={12} />}</span>
                </button>
              );
            })}
          </div>
          {error && <p className="error-banner" role="alert">{tr(error)}</p>}
          <p className="starter-permanent">{tr("Choix définitif. Valable pour tous tes overlays.")}</p>
          <div className="starter-actions">
            <Link href="/" className="text-link">{tr("Retour à l’accueil")}</Link>
            <button type="button" className="button primary" disabled={!selected || busy} onClick={() => void choose()}>
              {busy && <LoaderCircle size={16} className="spin" />}
              {selected ? tr("Choisir {name}", { name: tr(THEMES[selected].label) }) : tr("Choisir un type")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
