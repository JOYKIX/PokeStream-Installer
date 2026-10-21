"use client";
import { RotateCcw } from "lucide-react";
import { useId } from "react";
import { NumberInput } from "@/components/number-input";
import { ColorPicker } from "@/components/color-picker";
import { useI18n } from "@/i18n/client";
import { Select, SelectOption, SelectGroup } from "@/components/select";
import {
  THEMES,
  THEME_IDS,
  THEME_COLLECTIONS,
  requiresPro,
  type StarterId,
  type ThemeId,
} from "@/themes/catalog";
import type { CustomTheme } from "@/themes/custom/schema";
import type { ThemeRef } from "./schema";
export function NumberField({
  label,
  value,
  onChange,
  min = -3840,
  max = 3840,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="builder-field">
      <label htmlFor={id}>{t(label)}</label>
      <NumberInput
        id={id}
        label={t(label)}
        value={Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(value) => {
          if (value !== "" && Number.isFinite(Number(value)))
            onChange(Math.max(min, Math.min(max, Number(value))));
        }}
      />
    </div>
  );
}
export function ColorField({
  label,
  value,
  onChange,
  onReset,
  resetDisabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  resetDisabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="builder-color">
      <span>{t(label)}</span>
      <ColorPicker label={label} value={value} onChange={onChange} />
      <code>{value.toUpperCase()}</code>
      {onReset && (
        <button
          type="button"
          className="builder-reset"
          title={t("Réinitialiser la couleur")}
          aria-label={t("Réinitialiser la couleur")}
          disabled={resetDisabled}
          onClick={onReset}
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}
export function ThemeSelect({
  value,
  onChange,
  active,
  starter,
  themes,
  inherit = false,
  inheritLabel = "Thème principal",
  studio,
}: {
  value: ThemeRef | null;
  onChange: (v: ThemeRef | null) => void;
  active: boolean;
  starter: StarterId | null;
  themes: CustomTheme[];
  inherit?: boolean;
  inheritLabel?: string;
  studio?: { selected: boolean; onSelect: () => void };
}) {
  const { t } = useI18n();
  return (
    <Select
      aria-label={t("Thème")}
      value={
        studio?.selected
          ? "studio"
          : value
            ? value.id === "custom"
              ? "custom:" + value.customId
              : value.id
            : "inherit"
      }
      onValueChange={(v) => {
        if (v === "studio") {
          studio?.onSelect();
          return;
        }
        onChange(
          v === "inherit"
            ? null
            : v.startsWith("custom:")
              ? { id: "custom", customId: v.slice(7) }
              : { id: v as ThemeId },
        );
      }}
    >
      {inherit && (
        <SelectOption value="inherit">{t(inheritLabel)}</SelectOption>
      )}
      {studio && (
        <SelectOption value="studio">{t("Profil Studio")}</SelectOption>
      )}
      {Object.entries(THEME_COLLECTIONS).map(([collection, label]) => (
        <SelectGroup key={collection} label={t(label)}>
          {THEME_IDS.filter(
            (id) => id !== "custom" && THEMES[id].collection === collection,
          ).map((id) => (
            <SelectOption
              key={id}
              value={id}
              disabled={requiresPro(id, starter) && !active}
            >
              {t(THEMES[id].label)}
              {requiresPro(id, starter) && !active ? " · Pro" : ""}
            </SelectOption>
          ))}
        </SelectGroup>
      ))}
      {themes.length > 0 && (
        <SelectGroup label={t("Mes thèmes")}>
          {themes.map((theme) => (
            <SelectOption
              key={theme.id}
              value={"custom:" + theme.id}
              disabled={!active}
            >
              {theme.name}
            </SelectOption>
          ))}
        </SelectGroup>
      )}
    </Select>
  );
}
