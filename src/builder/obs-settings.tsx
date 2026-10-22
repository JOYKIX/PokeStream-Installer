"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Copy, Check, Download, ArrowLeft, ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Toggle, Confirm } from "@/components/ui";
import { copyText } from "@/lib/clipboard";
import type { SceneData } from "@/lib/model";
import { external, type BuilderRecord } from "./schema";
import { BuilderCanvas, type DisplayTheme } from "./render";
import { exportBuilderPNG } from "./export";
import { useBuilderDocument } from "./use-document";
export function BuilderOBSSettings({
  initial,
  scene,
  themes,
}: {
  initial: BuilderRecord;
  scene: SceneData | null;
  themes: DisplayTheme[];
}) {
  const { t, locale } = useI18n(),
    doc = useBuilderDocument(initial),
    [copied, setCopied] = useState(""),
    [busy, setBusy] = useState(false),
    [rotate, setRotate] = useState(false),
    art = useRef<HTMLDivElement>(null);
  const path = "/builder/obs/" + doc.record.view_token + "?lang=" + locale;
  async function copy(value: string, key: string) {
    try {
      await copyText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      doc.setError("Copie impossible.");
    }
  }
  const valueButton = (value: number, key: string) => (
    <button
      className="builder-coordinate"
      onClick={() => void copy(String(Math.round(value)), key)}
    >
      {Math.round(value)}{" "}
      {copied === key ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
  return (
    <main className="builder-obs-page">
      <Link className="back-link" href={"/builder/" + initial.id}>
        <ArrowLeft size={16} />
        {t("Retour à l’éditeur")}
      </Link>
      <div className="builder-home-heading">
        <div>
          <span className="eyebrow">OBS</span>
          <h1>{t("Utiliser dans OBS")}</h1>
          <p>{initial.data.name}</p>
        </div>
      </div>
      <section className="builder-obs-source">
        <div>
          <h2>{t("Source navigateur")}</h2>
          <p>1920 × 1080 px</p>
          <Toggle
            label="Diffusion activée"
            checked={doc.record.enabled}
            disabled={doc.saving}
            onChange={(enabled) => void doc.save({ enabled })}
          />
        </div>
        <div className="builder-obs-link">
          <code>{path}</code>
          <button
            className="button primary"
            onClick={() => void copy(window.location.origin + path, "url")}
          >
            {copied === "url" ? <Check size={16} /> : <Copy size={16} />}{" "}
            {t("Copier l’URL")}
          </button>
          <a
            className="button secondary"
            href={path}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            {t("Ouvrir")}
          </a>
        </div>
        <p className="builder-note">
          {t(
            "Place cette source au-dessus des captures de jeu, de la caméra et du chat.",
          )}
        </p>
        <button
          className="builder-text-button"
          disabled={doc.saving}
          onClick={() => setRotate(true)}
        >
          {t("Renouveler l’URL")}
        </button>
      </section>
      {doc.error && (
        <p role="alert" className="form-error">
          {t(doc.error)}
        </p>
      )}
      <h2>{t("Sources externes")}</h2>
      <p className="builder-note">
        {t(
          "Recopie ces valeurs dans « Modifier la transformation » d’OBS. Elles correspondent à l’intérieur du cadre.",
        )}
      </p>
      <div className="builder-table-wrap">
        <table className="builder-slot-table">
          <thead>
            <tr>
              <th>{t("Source")}</th>
              <th>X</th>
              <th>Y</th>
              <th>{t("Largeur")}</th>
              <th>{t("Hauteur")}</th>
              <th>{t("Rotation")}</th>
              <th>{t("Zone transparente")}</th>
            </tr>
          </thead>
          <tbody>
            {initial.data.elements
              .filter((e) => e.visible)
              .filter(external)
              .map((e) => (
                <tr key={e.id}>
                  <th>
                    {e.name}
                    {e.rotation !== 0 && <small> · {t("Centre")}</small>}
                  </th>
                  {[
                    e.rotation !== 0 ? e.x + e.width / 2 : e.x,
                    e.rotation !== 0 ? e.y + e.height / 2 : e.y,
                    e.width,
                    e.height,
                    e.rotation,
                  ].map((v, i) => (
                    <td key={i}>{valueButton(v, e.id + "-" + i)}</td>
                  ))}
                  <td>{t(e.properties.transparent ? "Oui" : "Non")}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="builder-note">
        {t("Pour les éléments tournés, choisis un alignement centré dans OBS.")}
      </p>
      <h2>{t("Export image")}</h2>
      <p className="builder-note">
        {t(
          "Le PNG est une image fixe. L’URL OBS conserve les mises à jour en direct.",
        )}
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          if (!art.current) return;
          setBusy(true);
          try {
            await exportBuilderPNG(art.current, initial.data.name);
          } catch {
            doc.setError("Export PNG impossible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={17} />
        {t(busy ? "Export…" : "Télécharger le PNG")}
      </button>
      <div className="builder-export-stage" aria-hidden="true">
        <BuilderCanvas
          data={initial.data}
          scene={scene}
          themes={themes}
          elementRef={art}
        />
      </div>
      <Confirm
        open={rotate}
        onOpenChange={setRotate}
        title={t("Renouveler l’URL ?")}
        description={t(
          "L’ancienne URL cessera de fonctionner. Mets la nouvelle dans OBS.",
        )}
        action={t("Renouveler")}
        onConfirm={() => void doc.save({ rotateToken: true })}
      />
    </main>
  );
}
