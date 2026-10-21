"use client";
import { useI18n } from "@/i18n/client";
import type { CSSProperties } from "react";
import type { Pokemon } from "@/lib/model";

export function PokemonHealth({ pokemon, showValues }: { pokemon: Pokemon; showValues: boolean }) {
  const { t: tr } = useI18n();
  const known = !pokemon.isEgg && pokemon.hp !== undefined && pokemon.maxHp !== undefined;
  const hp = pokemon.hp ?? 0;
  const max = pokemon.maxHp ?? 1;
  const ratio = Math.max(0, Math.min(1, hp / max));
  const state = ratio <= 0.2 ? "low" : ratio <= 0.5 ? "medium" : "high";
  return (
    <div className={"overlay-mon-info overlay-health-row" + (known ? "" : " egg-metadata-space")}
      aria-hidden={!known || undefined}>
      <div className="overlay-health" data-health={state}>
        {showValues && <div className="overlay-health-values" aria-hidden="true"><span>{tr("PV")}</span><span>{hp} / {max}</span></div>}
        <div className="overlay-health-track" role="meter" aria-label={tr("Points de vie")}
          aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} aria-valuetext={hp + tr(" PV sur ") + max}>
          <span className="overlay-health-fill" style={{ "--hp-ratio": ratio } as CSSProperties} />
        </div>
      </div>
    </div>
  );
}
