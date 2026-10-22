"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

/** An error in an adventure must never mutate or discard its saved data. */
export default function ErrorPage({ error, reset }: { error: Error & {digest?:string}; reset: () => void }) {
  const { t: tr } = useI18n();
  useEffect(() => {
    console.error("[PokeStream] Adventure / application render failure", error);
  }, [error]);
  const code = error.digest?.slice(0,64);
  const openLogs = () => {
    const bridge = (window as Window & {pokeStream?:{launcher?:{action:(name:string)=>Promise<unknown>}}}).pokeStream;
    void bridge?.launcher?.action("logs");
  };
  return <main className="center-page" id="main" role="alert">
    <h1>{tr("Une erreur est survenue.")}</h1>
    <p>{tr("Ton aventure reste sauvegardée.")}</p>
    {code && <p className="small muted">Diagnostic : <code>{code}</code></p>}
    <div className="error-recovery-actions">
      <button type="button" className="button primary" onClick={reset}>{tr("Réessayer")}</button>
      <Link className="button secondary" href="/studio">{tr("Mes profils")}</Link>
      <button type="button" className="button secondary" onClick={openLogs}>{tr("Ouvrir les logs")}</button>
    </div>
  </main>;
}
