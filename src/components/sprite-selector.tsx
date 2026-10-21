"use client";
import { useI18n } from "@/i18n/client";
import { Select, SelectOption, SelectGroup } from "./select";
import {
  SPRITE_SOURCES,
  SPRITE_GROUPS,
  VARIANT_LABELS,
  type SpriteStyle,
  type SpriteVariant,
} from "@/lib/sprite-options";
import { availableVariants } from "@/lib/sprites";
import type { SceneData } from "@/lib/model";
export function SpriteSelector({
  style,
  onChange,
  inherit,
}: {
  style: Pick<SceneData["style"], "sprite" | "spriteVariant">;
  onChange: (patch: Partial<SceneData["style"]>) => void;
  inherit?: { active: boolean; label: string; onSelect: () => void };
}) {
  const { t: tr } = useI18n();
  const variants = availableVariants(style.sprite);
  return (
    <>
      <label className="field">
        {tr("Illustrations")}
        <Select
          aria-label={tr("Illustrations")}
          value={inherit?.active ? "inherit" : style.sprite}
          onValueChange={(value) => {
            if (value === "inherit") {
              inherit?.onSelect();
              return;
            }
            const sprite = value as SpriteStyle;
            const allowed = availableVariants(sprite);
            onChange({
              sprite,
              spriteVariant: allowed.includes(style.spriteVariant ?? "default")
                ? style.spriteVariant
                : "default",
            });
          }}
        >
          {inherit && (
            <SelectOption value="inherit">{tr(inherit.label)}</SelectOption>
          )}
          {SPRITE_GROUPS.map((group) => (
            <SelectGroup key={group} label={tr(group)}>
              {SPRITE_SOURCES.filter((s) => s.group === group).map((s) => (
                <SelectOption key={s.id} value={s.id}>
                  {tr(s.label)}
                </SelectOption>
              ))}
            </SelectGroup>
          ))}
        </Select>
      </label>
      {!inherit?.active && variants.length > 1 && (
        <label className="field">
          {tr("Vue")}
          <Select
            aria-label={tr("Vue")}
            value={
              variants.includes(style.spriteVariant ?? "default")
                ? (style.spriteVariant ?? "default")
                : "default"
            }
            onValueChange={(value) =>
              onChange({ spriteVariant: value as SpriteVariant })
            }
          >
            {variants.map((v) => (
              <SelectOption key={v} value={v}>
                {tr(VARIANT_LABELS[v])}
              </SelectOption>
            ))}
          </Select>
        </label>
      )}
      <p className="sprite-note">
        {tr("Variantes selon le Pokémon. Remplacement si indisponible.")}
      </p>
    </>
  );
}
