"use client";
import { useRef, type ComponentPropsWithoutRef } from "react";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/i18n/client";

type NumberInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
> & {
  label: string;
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: string) => void;
};

export function NumberInput({
  label, value, min, max, step = 1, disabled, readOnly,
  className = "", onValueChange, ...props
}: NumberInputProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const number = value === "" ? null : Number(value);
  const locked = disabled || readOnly;

  function changeStep(direction: -1 | 1) {
    const field = input.current;
    // Parent fieldsets must disable the custom buttons as well.
    if (!field || field.matches(":disabled") || readOnly) return;
    if (direction > 0) field.stepUp();
    else field.stepDown();
    onValueChange(field.value);
  }

  return (
    <span className={"number-control " + className} role="group" aria-label={label}>
      <button type="button" className="number-step"
        aria-label={t("Diminuer {name}", { name: label })}
        title={t("Diminuer {name}", { name: label })}
        aria-controls={props.id}
        disabled={locked || number === null || (min !== undefined && number <= min)}
        onClick={() => changeStep(-1)}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <input {...props} ref={input} type="number"
        inputMode={props.inputMode ?? (Number.isInteger(step) ? "numeric" : "decimal")}
        aria-label={props["aria-label"] ?? label}
        min={min} max={max} step={step} value={value}
        disabled={disabled} readOnly={readOnly}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button type="button" className="number-step"
        aria-label={t("Augmenter {name}", { name: label })}
        title={t("Augmenter {name}", { name: label })}
        aria-controls={props.id}
        disabled={locked || (number !== null && max !== undefined && number >= max)}
        onClick={() => changeStep(1)}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

