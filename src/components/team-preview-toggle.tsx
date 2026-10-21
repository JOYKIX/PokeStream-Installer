"use client";
import { Users } from "lucide-react";
import { useI18n } from "@/i18n/client";

export function TeamPreviewToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="team-preview-toggle"
      aria-pressed={checked}
      title={t(
        "Aperçu uniquement : aucune modification de l’équipe enregistrée ou d’OBS.",
      )}
      onClick={() => onChange(!checked)}
    >
      <Users size={15} aria-hidden="true" />
      {t("Équipe de démo")}
      <span className="team-preview-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
