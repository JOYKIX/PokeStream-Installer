"use client";
import { useI18n } from "@/i18n/client";
import type { CSSProperties } from "react";

export function Range({
  id,
  disabled = false,
  value,
  min,
  max,
  step,
  label,
  valueText,
  onValueChange,
}: {
  id?: string;
  disabled?: boolean;
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  valueText?: string;
  onValueChange: (value: number) => void;
}) {
  const { t: tr } = useI18n();
  const progress = max > min
    ? Math.min(100, Math.max(0, (value - min) / (max - min) * 100))
    : 0;
  return (
    <input
      id={id}
      disabled={disabled}
      className="range-control"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={tr(label)}
      aria-valuetext={valueText}
      style={{ "--range-progress": `${progress}%` } as CSSProperties}
      onChange={(event) => onValueChange(Number(event.target.value))}
    />
  );
}
