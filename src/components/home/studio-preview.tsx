"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { THEMES } from "@/themes/catalog";
import { OverlayStage } from "@/components/overlay-stage";
import { homeScene } from "./sample-scene";

const previewThemes = ["carbon", "glass", "minimal"] as const;

export function StudioPreview() {
  const { t: tr } = useI18n();
  const [theme, setTheme] = useState<(typeof previewThemes)[number]>("carbon");
  const scene = useMemo(
    () => ({
      ...homeScene,
      style: {
        ...homeScene.style,
        theme,
        accent: THEMES[theme].defaultAccent ?? "#ef3340",
      },
    }),
    [theme],
  );

  return (
    <div className="home-studio-preview">
      <div className="home-preview-toolbar">
        <span>{tr("Exemple · Sinnoh")}</span>
        <div
          className="home-theme-options"
          role="group"
          aria-label={tr("Thème de l’aperçu")}
        >
          {previewThemes.map((id) => (
            <button
              type="button"
              key={id}
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
            >
              {tr(THEMES[id].label)}
            </button>
          ))}
        </div>
      </div>
      <div
        className="home-preview-canvas"
        role="img"
        aria-label={tr(
          "Équipe de Sinnoh avec PV, six badges obtenus et deux Pokémon perdus.",
        )}
      >
        <OverlayStage data={scene} maxHeight={360} />
      </div>
    </div>
  );
}
